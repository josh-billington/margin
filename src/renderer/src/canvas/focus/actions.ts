import { EASINGS, createShapeId } from 'tldraw'
import type { Editor, TLShapeId } from 'tldraw'
import type { VerseRef } from '@shared/bible/types'
import { verseKey } from '../highlights/ranges'
import type { PassageShape } from '../shapes/types'
import { CAMERA_MS, estimateVerseBounds, planFocusCamera, prefersReducedMotion } from './camera'
import type { Box, Camera } from './camera'
import { focusFor, resetFocus, useFocus } from './store'
import { pulledOutProps } from './pullOut'

const passageOf = (editor: Editor, id: string): PassageShape | undefined => {
	const shape = editor.getShape(id as TLShapeId)
	return shape?.type === 'passage' ? shape : undefined
}
const blockBounds = (shape: PassageShape): Box => ({
	x: shape.x,
	y: shape.y,
	w: shape.props.width,
	h: shape.props.h,
})
const viewportOf = (editor: Editor) => {
	const { w, h } = editor.getViewportScreenBounds()
	return { w, h }
}

/** Page-space bounds of a verse: measured DOM when mounted, otherwise proportional to length. */
export function verseBounds(editor: Editor, shape: PassageShape, verse: VerseRef): Box {
	const block = blockBounds(shape)
	const element = editor
		.getContainer()
		.querySelector(
			`.scripture-verse[data-passage-id="${shape.id}"][data-verse-key="${verseKey(verse)}"]`,
		)
	const rect = element?.getBoundingClientRect()
	if (rect && rect.height > 0) {
		const top = editor.screenToPage({ x: rect.left, y: rect.top }),
			bottom = editor.screenToPage({ x: rect.right, y: rect.bottom })
		return { x: block.x, y: top.y, w: block.w, h: Math.max(1, bottom.y - top.y) }
	}
	return estimatedVerseBounds(shape, verse)
}
/**
 * Page-space verse bounds measured against the block's own element, so the result does not depend
 * on the camera (safe inside reactive computations); falls back to the estimate when unmounted.
 */
export function laidOutVerseBounds(editor: Editor, shape: PassageShape, verse: VerseRef): Box {
	const element = editor
		.getContainer()
		.querySelector(
			`.scripture-verse[data-passage-id="${shape.id}"][data-verse-key="${verseKey(verse)}"]`,
		)
	const block = element?.closest<HTMLElement>('.passage-block')
	const rect = element?.getBoundingClientRect(),
		origin = block?.getBoundingClientRect()
	if (!block || !rect || !origin?.width || !rect.height) return estimatedVerseBounds(shape, verse)
	const scale = block.offsetWidth / origin.width
	return {
		x: shape.x,
		y: shape.y + (rect.top - origin.top) * scale,
		w: shape.props.width,
		h: rect.height * scale,
	}
}
/** Length-proportional verse bounds; independent of the camera and the DOM. */
export function estimatedVerseBounds(shape: PassageShape, verse: VerseRef): Box {
	const verses = shape.props.text.verses
	const index = Math.max(
		0,
		verses.findIndex((v) => verseKey(v.ref) === verseKey(verse)),
	)
	return estimateVerseBounds(
		blockBounds(shape),
		verses.map((v) => v.tokens.length),
		index,
	)
}

export function passageCamera(editor: Editor, shape: PassageShape): Camera {
	return planFocusCamera({
		viewport: viewportOf(editor),
		bounds: blockBounds(shape),
		fontScale: shape.props.fontScale,
		anchor: null,
	}).camera
}
export function verseCamera(editor: Editor, shape: PassageShape, verse: VerseRef): Camera {
	const bounds = verseBounds(editor, shape, verse)
	return planFocusCamera({
		viewport: viewportOf(editor),
		bounds,
		fontScale: shape.props.fontScale,
		anchor: { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
	}).camera
}

/** 280ms ease-out, or an immediate move under the OS reduced-motion setting. */
export function moveCamera(editor: Editor, camera: Camera) {
	const current = editor.getCamera()
	if (
		Math.abs(current.x - camera.x) < 0.5 &&
		Math.abs(current.y - camera.y) < 0.5 &&
		Math.abs(current.z - camera.z) < 0.001
	)
		return
	if (prefersReducedMotion()) editor.setCamera(camera, { immediate: true })
	else
		editor.setCamera(camera, { animation: { duration: CAMERA_MS, easing: EASINGS.easeOutCubic } })
}

export function focusPassage(editor: Editor, passageId: string) {
	const shape = passageOf(editor, passageId)
	if (!shape) return
	const state = focusFor(editor)
	// Replacing the focused passage keeps the original canvas return point.
	const canvasCamera = state?.canvasCamera ?? editor.getCamera()
	useFocus.setState({
		editor,
		target: { level: 'passage', passageId },
		canvasCamera,
		passageCamera: null,
	})
	editor.select(shape.id)
	moveCamera(editor, passageCamera(editor, shape))
}

export function focusVerse(editor: Editor, passageId: string, verse: VerseRef) {
	const shape = passageOf(editor, passageId)
	if (!shape || !shape.props.text.verses.some((v) => verseKey(v.ref) === verseKey(verse))) return
	const state = focusFor(editor)
	const samePassage = state?.target?.passageId === passageId
	const canvasCamera = state?.canvasCamera ?? editor.getCamera()
	let saved = state?.passageCamera ?? null
	if (!(samePassage && state?.target?.level === 'verse' && saved))
		saved =
			samePassage && state?.target?.level === 'passage'
				? editor.getCamera()
				: passageCamera(editor, shape)
	useFocus.setState({
		editor,
		target: { level: 'verse', passageId, verse },
		canvasCamera,
		passageCamera: saved,
	})
	editor.select(shape.id)
	moveCamera(editor, verseCamera(editor, shape, verse))
}

/** ↑/↓: from passage focus enters the first (↓) or last (↑) verse; otherwise steps and clamps. */
export function stepVerse(editor: Editor, delta: 1 | -1) {
	const state = focusFor(editor)
	const target = state?.target
	if (!target) return
	const shape = passageOf(editor, target.passageId)
	const verses = shape?.props.text.verses
	if (!shape || !verses?.length) return
	const current =
		target.level === 'verse'
			? verses.findIndex((v) => verseKey(v.ref) === verseKey(target.verse))
			: -1
	const next =
		current < 0
			? delta > 0
				? 0
				: verses.length - 1
			: Math.min(verses.length - 1, Math.max(0, current + delta))
	const verse = verses[next]?.ref
	if (verse) focusVerse(editor, shape.id, verse)
}

/** Esc: verse -> passage -> canvas, restoring the camera saved for the level being left. */
export function exitFocusLevel(editor: Editor) {
	const state = focusFor(editor)
	const target = state?.target
	if (!state || !target) return false
	if (target.level === 'verse') {
		if (state.passageCamera) moveCamera(editor, state.passageCamera)
		useFocus.setState({
			target: { level: 'passage', passageId: target.passageId },
			passageCamera: null,
		})
	} else {
		if (state.canvasCamera) moveCamera(editor, state.canvasCamera)
		resetFocus()
	}
	return true
}

/** The verse a header action or ⇧F should act on. */
export function activeVerse(editor: Editor, passageId: string): VerseRef | null {
	const target = focusFor(editor)?.target
	return target?.level === 'verse' && target.passageId === passageId ? target.verse : null
}

/** One undo transaction; notes and arrows stay with the source. Focuses the new block. */
export function pullOutVerse(editor: Editor, passageId: string, verse: VerseRef) {
	const source = passageOf(editor, passageId)
	if (!source || editor.getIsReadonly()) return null
	const props = pulledOutProps(source.props, source.id, verse)
	if (!props) return null
	const id = createShapeId(),
		top = verseBounds(editor, source, verse).y
	editor.markHistoryStoppingPoint('pull out verse')
	editor.run(() => {
		editor.createShape({
			id,
			type: 'passage',
			x: source.x + source.props.width + 96,
			y: Math.max(source.y, top),
			props: { ...props, h: 160 },
		})
	})
	focusPassage(editor, id)
	return id
}
