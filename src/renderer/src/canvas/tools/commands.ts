import { Box, createShapeId, react } from 'tldraw'
import type { Editor } from 'tldraw'
import type { PassageText } from '@shared/bible/types'
import { shortcutsSuppressed } from '../shortcutContext'
import { newNoteProps } from '../shapes/note/newNote'
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
	if (moved) {
		const { w, h } = editor.getViewportScreenBounds()
		const top = { x: x + INSERT_W / 2, y: y + h / 2 / editor.getZoomLevel() - INSERT_GAP }
		moveCamera(editor, centerOn({ w, h }, top, editor.getZoomLevel()))
	}
	return id
}
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
		const tool = { v: 'select', t: 'margin-note', a: 'arrow', h: 'highlight' }[
			event.key.toLowerCase()
		]
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
	const onDoubleClick = (event: MouseEvent) => {
		if (
			!(event.target instanceof Element) ||
			!editor.getContainer().contains(event.target) ||
			event.target.closest('[data-shape-id], .tl-html-container, button, input, textarea')
		)
			return
		const point = editor.screenToPage({ x: event.clientX, y: event.clientY })
		if (editor.getShapeAtPoint(point, { hitInside: true })) return
		event.preventDefault()
		event.stopImmediatePropagation()
		const id = createShapeId()
		editor.markHistoryStoppingPoint('create note')
		editor
			.createShape({ id, type: 'margin-note', x: point.x, y: point.y, props: newNoteProps() })
			.setCurrentTool('select')
			.select(id)
			.setEditingShape(id)
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
	editor.getContainer().addEventListener('dblclick', onDoubleClick, true)
	return () => {
		removeShortcuts()
		document.removeEventListener('keydown', onKeyDown, true)
		editor.getContainer().removeEventListener('pointermove', onPointerMove)
		window.removeEventListener('pointerup', clearPreview, true)
		window.removeEventListener('pointercancel', clearPreview, true)
		stopToolWatch()
		editor.getContainer().removeEventListener('dblclick', onDoubleClick, true)
		preview?.classList.remove('word-anchor-preview')
	}
}
