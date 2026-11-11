import type { Editor, TLArrowBinding, TLArrowShape, TLShapeId } from 'tldraw'
import { wordTargetSchema, wordBindingMetadataSchema } from '@shared/study/types'
import type { WordTarget } from '@shared/study/types'
import { wordKey } from '../highlights/ranges'
import type { PassageShape } from '../shapes/types'
import { derived } from './derived'
import {
	DEFAULT_BEND,
	HEAD_LENGTH,
	WORD_GAP,
	approach,
	arcMiddle,
	outwardBend,
	wordTerminal,
} from './terminals'
import type { Box, Point } from './terminals'

export function targetFromElement(element: Element) {
	return wordTargetSchema.parse({
		verse: {
			book: element.getAttribute('data-book'),
			chapter: Number(element.getAttribute('data-chapter')),
			verse: Number(element.getAttribute('data-verse-number')),
		},
		token: Number(element.getAttribute('data-token-index')),
	})
}
export function wordAtScreenPoint(editor: Editor, point: { x: number; y: number }) {
	for (const node of document.elementsFromPoint(point.x, point.y)) {
		const element = node.closest<HTMLElement>('[data-word]')
		if (!element || !editor.getContainer().contains(element)) continue
		const shape = editor.getCurrentPageShapes().find((s) => s.id === element.dataset.passageId)
		if (shape?.type === 'passage') return { element, shape, target: targetFromElement(element) }
	}
	return undefined
}
export function normalizedWordCenter(editor: Editor, shape: PassageShape, element: Element) {
	const box = measureWord(editor, shape, element)
	return normalize(shape, { x: box.x + box.w / 2, y: box.y + box.h / 2 })
}

const round = (value: number) => Math.round(value * 10000) / 10000
function normalize(shape: PassageShape, local: Point) {
	return { x: round(local.x / shape.props.width), y: round(local.y / shape.props.h) }
}

/**
 * Word boxes in passage space, refreshed whenever a block lays out. Terminals are recomputed from
 * them while the block is dragged, before its DOM has moved. A box is only trusted for the props it
 * was measured with; after a reflow it waits for the next measure (culled blocks keep geometry).
 */
const wordBoxes = new WeakMap<Editor, Map<string, { box: Box; props: PassageShape['props'] }>>()
const boxKey = (shapeId: TLShapeId, target: WordTarget) => `${shapeId}|${wordKey(target)}`
function measureWord(editor: Editor, shape: PassageShape, element: Element): Box {
	const rect = element.getBoundingClientRect()
	const a = editor.getPointInShapeSpace(shape, editor.screenToPage({ x: rect.left, y: rect.top }))
	const b = editor.getPointInShapeSpace(
		shape,
		editor.screenToPage({ x: rect.right, y: rect.bottom }),
	)
	const box = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
	let boxes = wordBoxes.get(editor)
	if (!boxes) wordBoxes.set(editor, (boxes = new Map()))
	boxes.set(boxKey(shape.id, targetFromElement(element)), { box, props: shape.props })
	return box
}
function wordBox(editor: Editor, binding: TLArrowBinding) {
	const metadata = wordBindingMetadataSchema.safeParse(binding.meta)
	if (!metadata.success) return undefined
	const entry = wordBoxes.get(editor)?.get(boxKey(binding.toId, metadata.data.target))
	const passage = editor.getShape(binding.toId)
	return entry && passage?.type === 'passage' && passage.props === entry.props
		? entry.box
		: undefined
}

/** Where the arrow aims from this terminal's side: word centre, bound-shape anchor, or free point. */
function reference(
	editor: Editor,
	arrow: TLArrowShape,
	terminal: 'start' | 'end',
	binding?: TLArrowBinding,
) {
	if (!binding) return editor.getShapePageTransform(arrow).applyToPoint(arrow.props[terminal])
	const target = editor.getShape(binding.toId)
	if (!target) return undefined
	const box = wordBox(editor, binding)
	const bounds = editor.getShapeGeometry(target).bounds
	const local = box
		? { x: box.x + box.w / 2, y: box.y + box.h / 2 }
		: binding.props.isPrecise
			? {
					x: bounds.x + binding.props.normalizedAnchor.x * bounds.w,
					y: bounds.y + binding.props.normalizedAnchor.y * bounds.h,
				}
			: bounds.center
	return editor.getShapePageTransform(target).applyToPoint(local)
}

/**
 * Normalized anchor that puts this word-bound terminal just outside its word, on the side the
 * arrow's body arrives from. `bend` overrides the arrow's own (used while it is being created).
 */
export function wordAnchor(
	editor: Editor,
	arrow: TLArrowShape,
	terminal: 'start' | 'end',
	passage: PassageShape,
	box: Box,
	bend = arrow.props.bend,
) {
	const bindings = editor.getBindingsFromShape<TLArrowBinding>(arrow.id, 'arrow')
	const other = terminal === 'start' ? 'end' : 'start'
	const far = reference(
		editor,
		arrow,
		other,
		bindings.find((b) => b.props.terminal === other),
	)
	const page = editor.getShapePageTransform(passage)
	const centre = page.applyToPoint({ x: box.x + box.w / 2, y: box.y + box.h / 2 })
	let direction: Point = { x: 0, y: -1 }
	if (far && Math.hypot(far.x - centre.x, far.y - centre.y) > 1) {
		const [start, end] = terminal === 'start' ? [centre, far] : [far, centre]
		direction = approach(centre, far, arc(arrow, bend) ? arcMiddle(start, end, bend) : undefined)
	}
	// Page-space direction to passage space (passages are unrotated, but stay honest).
	const rotation = page.rotation()
	const local = {
		x: direction.x * Math.cos(-rotation) - direction.y * Math.sin(-rotation),
		y: direction.x * Math.sin(-rotation) + direction.y * Math.cos(-rotation),
	}
	return normalize(
		passage,
		wordTerminal(box, local, WORD_GAP * arrow.props.scale, HEAD_LENGTH * arrow.props.scale),
	)
}
const arc = (arrow: TLArrowShape, bend: number) =>
	arrow.props.kind !== 'elbow' && Math.abs(bend) >= 8 * arrow.props.scale

/** Creation-time bend: same magnitude, bulging away from the block's centre towards its margin. */
export function outwardWordBend(
	editor: Editor,
	arrow: TLArrowShape,
	terminal: 'start' | 'end',
	passage: PassageShape,
	element: Element,
) {
	const box = measureWord(editor, passage, element)
	const page = editor.getShapePageTransform(passage)
	const here = page.applyToPoint({ x: box.x + box.w / 2, y: box.y + box.h / 2 })
	const other = terminal === 'start' ? 'end' : 'start'
	const bindings = editor.getBindingsFromShape<TLArrowBinding>(arrow.id, 'arrow')
	const far = reference(
		editor,
		arrow,
		other,
		bindings.find((b) => b.props.terminal === other),
	)
	const bounds = editor.getShapePageBounds(passage)
	if (!far || !bounds) return arrow.props.bend
	const [start, end] = terminal === 'start' ? [here, far] : [far, here]
	return outwardBend(start, end, bounds.center, Math.abs(arrow.props.bend) || DEFAULT_BEND)
}

export function wordAnchorForElement(
	editor: Editor,
	arrow: TLArrowShape,
	terminal: 'start' | 'end',
	passage: PassageShape,
	element: Element,
	bend?: number,
) {
	return wordAnchor(editor, arrow, terminal, passage, measureWord(editor, passage, element), bend)
}

/** Recompute word-bound terminals for `arrowIds`; batched, rounded, identical writes skipped. */
export function syncWordArrows(editor: Editor, arrowIds: Iterable<TLShapeId>) {
	const updates: {
		id: TLArrowBinding['id']
		type: 'arrow'
		props: Partial<TLArrowBinding['props']>
	}[] = []
	for (const id of arrowIds) {
		const arrow = editor.getShape(id)
		if (arrow?.type !== 'arrow') continue
		for (const binding of editor.getBindingsFromShape<TLArrowBinding>(id, 'arrow')) {
			const passage = editor.getShape(binding.toId)
			const box = wordBox(editor, binding)
			if (passage?.type !== 'passage' || !box) continue // Unmeasured: keep last good geometry.
			const anchor = wordAnchor(editor, arrow, binding.props.terminal, passage, box)
			if (
				anchor.x !== binding.props.normalizedAnchor.x ||
				anchor.y !== binding.props.normalizedAnchor.y ||
				!binding.props.isExact ||
				!binding.props.isPrecise
			)
				updates.push({
					id: binding.id,
					type: 'arrow',
					props: { normalizedAnchor: anchor, isExact: true, isPrecise: true },
				})
		}
	}
	if (updates.length) derived(editor, () => editor.updateBindings(updates))
}

export function reconcileWords(editor: Editor, shape: PassageShape, root: HTMLElement) {
	const elements = new Map(
		Array.from(root.querySelectorAll('[data-word]'), (element) => [
			wordKey(targetFromElement(element)),
			element,
		]),
	)
	const arrows = new Set<TLShapeId>()
	for (const binding of editor.getBindingsToShape<TLArrowBinding>(shape.id, 'arrow')) {
		const metadata = wordBindingMetadataSchema.safeParse(binding.meta)
		if (!metadata.success) continue
		const element = elements.get(wordKey(metadata.data.target))
		if (!element) continue // Culling keeps the last good geometry until remount.
		measureWord(editor, shape, element)
		arrows.add(binding.fromId)
	}
	syncWordArrows(editor, arrows)
}

/** Arrows with a word terminal whose approach may have changed. */
function wordArrowsTouching(editor: Editor, shapeId: TLShapeId, into: Set<TLShapeId>) {
	const shape = editor.getShape(shapeId)
	if (!shape) return
	const arrowIds =
		shape.type === 'arrow'
			? [shape.id]
			: editor.getBindingsToShape<TLArrowBinding>(shapeId, 'arrow').map((b) => b.fromId)
	for (const id of arrowIds)
		if (
			editor
				.getBindingsFromShape<TLArrowBinding>(id, 'arrow')
				.some((b) => wordBindingMetadataSchema.safeParse(b.meta).success)
		)
			into.add(id)
}

/**
 * Keep word terminals on the approach side as either end, the arrow's bend, or a bound block moves.
 * Coalesced into one derived write per microtask, so drags don't add history or autosave noise.
 */
export function installWordTerminals(editor: Editor) {
	const pending = new Set<TLShapeId>()
	let queued = false
	const flush = () => {
		queued = false
		const ids = [...pending]
		pending.clear()
		if (!editor.isDisposed) syncWordArrows(editor, ids)
	}
	const touch = (shapeId: TLShapeId) => {
		wordArrowsTouching(editor, shapeId, pending)
		if (pending.size && !queued) {
			queued = true
			queueMicrotask(flush)
		}
	}
	const cleanups = [
		editor.sideEffects.registerAfterChangeHandler('shape', (before, after) => {
			if (
				before.x !== after.x ||
				before.y !== after.y ||
				before.rotation !== after.rotation ||
				before.props !== after.props
			)
				touch(after.id)
		}),
		editor.sideEffects.registerAfterCreateHandler('binding', (binding) => touch(binding.fromId)),
		editor.sideEffects.registerAfterChangeHandler('binding', (before, after) => {
			if (before.toId !== after.toId || before.props.terminal !== after.props.terminal)
				touch(after.fromId)
		}),
	]
	return () => cleanups.forEach((cleanup) => cleanup())
}
