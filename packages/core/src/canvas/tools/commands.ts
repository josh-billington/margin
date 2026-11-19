import { Box, createShapeId, react } from 'tldraw'
import type { Editor, TLShapeId } from 'tldraw'
import type { PassageText } from '@shared/bible/types'
import { shortcutsSuppressed } from '../shortcutContext'
import { moveCamera } from '../focus/actions'
import { centerOn } from '../focus/camera'
import { installShortcuts, shortcutContext } from './shortcuts'
import { noteFromSelection } from './noteFromSelection'

const INSERT_W = 720
const INSERT_H = 320
const INSERT_GAP = 48

/** Viewport centre, or just below whatever already sits there so a new block never covers another. */
function insertionPoint(editor: Editor) {
	const center = editor.getViewportPageBounds().center
	const spot = new Box(center.x - INSERT_W / 2, center.y - INSERT_H / 2, INSERT_W, INSERT_H)
	const occupied = editor
		.getCurrentPageShapes()
		.map((shape) => editor.getShapePageBounds(shape))
		.filter((bounds): bounds is Box => !!bounds)
	for (let tries = 0; tries < 50; tries++) {
		const hits = occupied.filter((bounds) => bounds.collides(spot))
		if (!hits.length) break
		spot.y = Math.max(...hits.map((bounds) => bounds.maxY)) + INSERT_GAP
	}
	return { x: spot.x, y: spot.y, moved: spot.y !== center.y - INSERT_H / 2 }
}

export function insertPassage(editor: Editor, text: PassageText) {
	const id = createShapeId(),
		{ x, y, moved } = insertionPoint(editor)
	editor.markHistoryStoppingPoint('insert passage')
	editor.createShape({ id, type: 'passage', x, y, props: { text } }).select(id)
	revealWhenMeasured(editor, id, moved)
	return id
}

/** Screen space kept clear above the floating toolbar when deciding whether a block fits. */
const TOOLBAR_CLEARANCE = 72

/**
 * The block's real height is only known once it has rendered. When it was pushed below other
 * blocks, or a long chapter runs off the bottom of the view, bring its first verse up near the
 * top so the reader starts reading instead of scrolling.
 */
function revealWhenMeasured(editor: Editor, id: TLShapeId, moved: boolean) {
	const initial = editor.getShape(id)?.props as { h?: number } | undefined
	let frames = 0
	const check = () => {
		const shape = editor.getShape(id)
		if (!shape || shape.type !== 'passage') return
		if (shape.props.h === initial?.h && frames++ < 12) return void requestAnimationFrame(check)
		const bounds = editor.getShapePageBounds(id)
		if (!bounds) return
		const zoom = editor.getZoomLevel()
		const view = editor.getViewportPageBounds()
		if (!moved && bounds.maxY <= view.maxY - TOOLBAR_CLEARANCE / zoom) return
		const { w, h } = editor.getViewportScreenBounds()
		const top = { x: bounds.midX, y: bounds.minY + h / 2 / zoom - INSERT_GAP / zoom }
		moveCamera(editor, centerOn({ w, h }, top, zoom))
	}
	requestAnimationFrame(check)
}
export function installCanvasCommands(editor: Editor, { freehandInk = false } = {}) {
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
		const context = shortcutContext(editor, event)
		// T with scripture words selected: a note already joined to them by an arrow.
		if (
			event.key.toLowerCase() === 't' &&
			shortcutsSuppressed({ ...context, textSelected: false }) === false &&
			noteFromSelection(editor)
		) {
			event.preventDefault()
			event.stopImmediatePropagation()
			return
		}
		if (shortcutsSuppressed(context)) return
		const tool = {
			v: 'select',
			t: 'margin-note',
			a: freehandInk ? undefined : 'arrow',
			h: 'highlight',
		}[event.key.toLowerCase()]
		if (tool) {
			event.preventDefault()
			event.stopImmediatePropagation()
			editor.setCurrentTool(tool)
		}
		if (event.key.toLowerCase() === 'x') {
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
