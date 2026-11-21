import { createShapeId } from 'tldraw'
import type { Editor, TLEventInfo } from 'tldraw'
import { newNoteProps } from '../shapes/note/newNote'
import { focusPassage } from '../focus/actions'

/** A double click or double tap on empty canvas starts a note there, ready to type. */
function noteAt(editor: Editor, target: EventTarget | null, client: { x: number; y: number }) {
	if (
		!(target instanceof Element) ||
		!editor.getContainer().contains(target) ||
		target.closest('[data-shape-id], .tl-html-container, button, input, textarea')
	)
		return false
	const point = editor.screenToPage(client)
	if (editor.getShapeAtPoint(point, { hitInside: true })) return false
	const id = createShapeId()
	editor.markHistoryStoppingPoint('create note')
	editor
		.createShape({ id, type: 'margin-note', x: point.x, y: point.y, props: newNoteProps() })
		.setCurrentTool('select')
		.select(id)
		.setEditingShape(id)
	return true
}

/**
 * Touch on the canvas. Its double-click actions: a mouse keeps the browser's `dblclick`; a finger
 * or pencil uses tldraw's own double-click recognition, because touch does not reliably raise
 * `dblclick`. Each input has one route, so a double tap that also raises `dblclick` acts once.
 */
export function installTouchRoutes(editor: Editor) {
	const container = editor.getContainer()
	let last: { pointerType: string; target: EventTarget | null } = {
		pointerType: 'mouse',
		target: null,
	}
	const onPointerDown = (event: PointerEvent) => {
		last = { pointerType: event.pointerType, target: event.target }
	}
	const onDoubleClick = (event: MouseEvent) => {
		if (last.pointerType !== 'mouse') return
		if (!noteAt(editor, event.target, { x: event.clientX, y: event.clientY })) return
		event.preventDefault()
		event.stopImmediatePropagation()
	}
	const onEvent = (info: TLEventInfo) => {
		if (info.type !== 'click' || info.name !== 'double_click' || info.phase !== 'up') return
		if (last.pointerType === 'mouse' || info.shiftKey || info.ctrlKey) return
		const element = last.target instanceof Element ? last.target : null
		// The verse block header's double click focuses the block (PassageComponent).
		const header = element?.closest('.passage-header')
		const passageId = header?.closest<HTMLElement>('[data-shape-id]')?.dataset.shapeId
		if (header && passageId && !element?.closest('button, [role="menu"]'))
			focusPassage(editor, passageId)
		else noteAt(editor, element, info.point)
	}
	// tldraw cancels the touchend of any HTML element on the canvas, so the tap would never click.
	// Menus and popovers opened from the canvas are portalled out of its DOM but not its React tree,
	// and controls on it (a note's options, the reading focus buttons) are buttons: neither is a
	// canvas touch.
	const onTouch = (event: TouchEvent) => {
		const target = event.target
		if (!(target instanceof Node)) return
		if (!container.contains(target) || (target instanceof Element && target.closest('button')))
			editor.markEventAsHandled(event)
	}
	container.addEventListener('pointerdown', onPointerDown, true)
	container.addEventListener('dblclick', onDoubleClick, true)
	editor.on('event', onEvent)
	window.addEventListener('touchstart', onTouch, true)
	window.addEventListener('touchend', onTouch, true)
	return () => {
		window.removeEventListener('touchstart', onTouch, true)
		window.removeEventListener('touchend', onTouch, true)
		container.removeEventListener('pointerdown', onPointerDown, true)
		container.removeEventListener('dblclick', onDoubleClick, true)
		editor.off('event', onEvent)
	}
}
