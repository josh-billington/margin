import { Box, createShapeId, react } from 'tldraw'
import type { Editor, TLShapeId } from 'tldraw'
import type { PassageText } from '@shared/bible/types'
import { shortcutsSuppressed } from '../shortcutContext'
import { moveCamera } from '../focus/actions'
import { fitZoom, minReadableZoom } from '../focus/camera'
import { setArrival } from '../shapes/passage/arrival'
import { installShortcuts, shortcutContext } from './shortcuts'
import { noteFromSelection } from './noteFromSelection'
import { chooseDiagramTool, diagramToolForKey, isDiagramShape } from '../diagrams/tools'
import { DrawTool } from '../ink/tools'

const INSERT_W = 720
const INSERT_H = 320
const INSERT_GAP = 48

/** Pushes `spot` down below anything it would cover, so a new block never lands on another. */
function clearOf(spot: Box, occupied: readonly Box[]) {
	for (let tries = 0; tries < 50; tries++) {
		const hits = occupied.filter((bounds) => bounds.collides(spot))
		if (!hits.length) break
		spot.y = Math.max(...hits.map((bounds) => bounds.maxY)) + INSERT_GAP
	}
	return spot
}

const pageBounds = (editor: Editor, except: ReadonlySet<TLShapeId> = new Set()) =>
	editor
		.getCurrentPageShapes()
		.filter((shape) => !except.has(shape.id))
		.map((shape) => editor.getShapePageBounds(shape))
		.filter((bounds): bounds is Box => !!bounds)

/** Viewport centre, or just below whatever already sits there. */
function insertionPoint(editor: Editor) {
	const center = editor.getViewportPageBounds().center
	const spot = new Box(center.x - INSERT_W / 2, center.y - INSERT_H / 2, INSERT_W, INSERT_H)
	return clearOf(spot, pageBounds(editor))
}

export function insertPassage(editor: Editor, text: PassageText) {
	const id = createShapeId()
	addBlocks(editor, [{ id, text }])
	return id
}

/**
 * Adds verse blocks as one undoable step, in a column under the view's centre (or below whatever
 * already sits there), then frames them so the reader sees what landed and where.
 *
 * Each block's height is only known once it has rendered, so the blocks start unseen, stacked on
 * the view (where they aren't culled and so do render), and are placed by their real heights
 * once measured. Then they are selected, the view moves to them, and they fade in where they are.
 */
export function insertPassages(editor: Editor, texts: readonly PassageText[]) {
	const blocks = texts.map((text) => ({ id: createShapeId(), text }))
	addBlocks(editor, blocks)
	return blocks.map(({ id }) => id)
}

function addBlocks(editor: Editor, blocks: readonly { id: TLShapeId; text: PassageText }[]) {
	if (!blocks.length) return
	const ids = blocks.map(({ id }) => id)
	const start = insertionPoint(editor)
	const view = editor.getViewportPageBounds()
	editor.markHistoryStoppingPoint('insert passage')
	setArrival(ids, 'pending')
	editor.createShapes(
		blocks.map(({ id, text }) => ({
			id,
			type: 'passage',
			x: start.x,
			y: view.center.y - INSERT_H / 2,
			props: { text },
		})),
	)
	placeWhenMeasured(editor, ids, start)
}

/** Frames to wait for a block to measure before placing it by its estimated height. */
const MEASURE_FRAMES = 12
/** Long enough for the arrival fade (canvas.css) to finish. */
const ARRIVAL_MS = 400

function measured(editor: Editor, id: TLShapeId) {
	const shape = editor.getShape(id)
	const element = editor
		.getContainer()
		.querySelector<HTMLElement>(`.tl-shape[data-shape-id="${id}"] .passage-block`)
	return (
		shape?.type === 'passage' && !!element?.offsetHeight && element.offsetHeight === shape.props.h
	)
}

function placeWhenMeasured(editor: Editor, ids: readonly TLShapeId[], start: Box) {
	let frames = 0
	const check = () => {
		const live = ids.filter((id) => editor.getShape(id))
		// Undone before it arrived.
		if (!live.length) return setArrival(ids, null)
		if (!live.every((id) => measured(editor, id)) && frames++ < MEASURE_FRAMES)
			return void requestAnimationFrame(check)
		const union = stack(editor, live, start)
		editor.select(...live)
		if (union) frame(editor, union)
		setArrival(live, 'in')
		setTimeout(() => setArrival(ids, null), ARRIVAL_MS)
	}
	requestAnimationFrame(check)
}

/** One block under another, INSERT_GAP apart, each clear of what was already there. */
function stack(editor: Editor, ids: readonly TLShapeId[], start: Box) {
	const occupied = pageBounds(editor, new Set(ids))
	let y = start.y
	let union: Box | undefined
	const moves = ids.flatMap((id) => {
		const shape = editor.getShape(id)
		if (shape?.type !== 'passage') return []
		const spot = clearOf(new Box(start.x, y, shape.props.width, shape.props.h), occupied)
		y = spot.maxY + INSERT_GAP
		union = union ? union.union(spot) : spot.clone()
		return [{ id, type: 'passage' as const, x: spot.x, y: spot.y }]
	})
	editor.updateShapes(moves)
	return union
}

/**
 * Leaves the view alone when everything added is already in it. Otherwise it centres them, zooming
 * out only as far as keeps scripture readable; blocks that still don't fit start at the top, so the
 * reader starts at the first of them instead of scrolling.
 */
function frame(editor: Editor, union: Box) {
	const zoom = editor.getZoomLevel()
	const view = editor.getViewportPageBounds()
	if (
		union.minX >= view.minX &&
		union.maxX <= view.maxX &&
		union.minY >= view.minY &&
		union.maxY <= view.maxY - TOOLBAR_CLEARANCE / zoom
	)
		return
	const { w, h } = editor.getViewportScreenBounds()
	const area = { w, h: h - TOOLBAR_CLEARANCE }
	const fit = fitZoom(area, union, INSERT_GAP)
	const readable = minReadableZoom(1)
	// A zoom out lands on a whole 5% step, so the zoom readout says 95% rather than 98%.
	const z =
		fit >= zoom ? zoom : fit >= readable ? Math.max(readable, Math.floor(fit * 20) / 20) : zoom
	moveCamera(editor, {
		x: w / 2 / z - union.midX,
		y: z === zoom && fit < zoom ? INSERT_GAP / z - union.minY : area.h / 2 / z - union.midY,
		z,
	})
}

/** Screen space kept clear above the floating toolbar when deciding whether a block fits. */
const TOOLBAR_CLEARANCE = 72

export function installCanvasCommands(editor: Editor) {
	let preview: HTMLElement | undefined
	const clearPreview = () => {
		preview?.classList.remove('word-anchor-preview')
		preview = undefined
	}
	const onPointerMove = (event: PointerEvent) => {
		clearPreview()
		if (editor.getCurrentToolId() === 'arrow' || editor.isIn('select.dragging_handle')) {
			const word = document
				.elementsFromPoint(event.clientX, event.clientY)
				.map((e) => e.closest<HTMLElement>('[data-word]'))
				.find((e) => e && editor.getContainer().contains(e))
			if (word) {
				preview = word
				preview.classList.add('word-anchor-preview')
			}
		}
	}
	const onKeyDown = (event: KeyboardEvent) => {
		if (getComputedStyle(editor.getContainer()).visibility === 'hidden') return
		if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
		const key = event.key.toLowerCase()
		const context = shortcutContext(editor, event)
		if (
			key === 'escape' &&
			!context.isComposing &&
			context.keyCode !== 229 &&
			!context.popoverOpen &&
			isDiagramShape(editor.getEditingShape() ?? undefined)
		) {
			event.preventDefault()
			event.stopImmediatePropagation()
			editor.complete()
			return
		}
		// T with scripture words selected: a note already joined to them by an arrow.
		if (
			key === 't' &&
			shortcutsSuppressed({ ...context, textSelected: false }) === false &&
			noteFromSelection(editor)
		) {
			event.preventDefault()
			event.stopImmediatePropagation()
			return
		}
		if (shortcutsSuppressed(context)) return
		const diagram = diagramToolForKey(key)
		if (diagram) {
			event.preventDefault()
			event.stopImmediatePropagation()
			chooseDiagramTool({ editor, tool: diagram })
			return
		}
		const tool = {
			v: 'select',
			t: 'margin-note',
			a: 'arrow',
			d: DrawTool.id,
			h: 'highlight',
		}[key]
		if (tool) {
			event.preventDefault()
			event.stopImmediatePropagation()
			editor.setCurrentTool(tool)
		}
		if (key === 'x') {
			const arrows = editor.getSelectedShapes().filter((s) => s.type === 'arrow')
			if (arrows.length) {
				event.preventDefault()
				editor.markHistoryStoppingPoint('reverse bend')
				editor.updateShapes(
					arrows.map((s) => ({ id: s.id, type: s.type, props: { bend: -s.props.bend || -28 } })),
				)
			}
		}
	}
	const removeShortcuts = installShortcuts(editor)
	document.addEventListener('keydown', onKeyDown, true)
	editor.getContainer().addEventListener('pointermove', onPointerMove)
	// The preview ends with the arrow interaction: release (anywhere), cancel, or leaving the tool.
	window.addEventListener('pointerup', clearPreview, true)
	window.addEventListener('pointercancel', clearPreview, true)
	const stopToolWatch = react('margin word anchor preview', () => {
		if (editor.getCurrentToolId() !== 'arrow' && !editor.isIn('select.dragging_handle'))
			clearPreview()
	})
	return () => {
		removeShortcuts()
		document.removeEventListener('keydown', onKeyDown, true)
		editor.getContainer().removeEventListener('pointermove', onPointerMove)
		window.removeEventListener('pointerup', clearPreview, true)
		window.removeEventListener('pointercancel', clearPreview, true)
		stopToolWatch()
		preview?.classList.remove('word-anchor-preview')
	}
}
