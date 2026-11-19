import { createShapeId, StateNode } from 'tldraw'
import type { Editor, TLShapeId } from 'tldraw'
import type { InkPoint, InkStroke } from '@shared/study/types'
import { newNoteProps } from '../shapes/note/newNote'
import { finishArrow } from './finishArrow'
import { NOTE_INK_HEIGHT, NOTE_INK_WIDTH } from './notePad'
import { strokePath } from './stroke'

export class InkArrowTool extends StateNode {
	static override id = 'margin-ink-arrow'
	override onCancel() {
		this.editor.setCurrentTool('select')
	}
}
export class HandwriteTool extends StateNode {
	static override id = 'margin-handwrite'
	override onCancel() {
		this.editor.setCurrentTool('select')
	}
}

const svgNs = 'http://www.w3.org/2000/svg'
const onCanvas = (target: EventTarget | null) =>
	target instanceof Element &&
	!target.closest('button, input, textarea, [role="menu"], [role="dialog"]')
const clientPoint = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY })
type Point = ReturnType<typeof clientPoint>
let penUsed = false

type DrawingSurface = { kind: 'canvas' } | { kind: 'note'; id: TLShapeId; pad: Element }
type Gesture =
	| {
			kind: 'draw'
			surface: DrawingSurface
			pointerId: number
			pen: boolean
			points: InkStroke
			sample: (event: PointerEvent) => InkPoint
			svg: SVGSVGElement
			path: SVGPathElement
	  }
	| { kind: 'pan'; pointerId: number; origin: Point; last: Point; moved: boolean }
	| { kind: 'place-note'; pointerId: number; origin: Point }

function targetAt({ editor, point }: { editor: Editor; point: Point }) {
	return editor.getShapeAtPoint(editor.screenToPage(point), { hitInside: true })
}

function placeNote({ editor, point }: { editor: Editor; point: Point }) {
	const target = targetAt({ editor, point })
	if (target?.type === 'margin-note') {
		editor.select(target.id)
	} else if (!target) {
		const position = editor.screenToPage(point)
		const id = createShapeId()
		editor.markHistoryStoppingPoint('create note')
		editor
			.createShape({ id, type: 'margin-note', x: position.x, y: position.y, props: newNoteProps() })
			.select(id)
	}
}

function beginDrawing({
	editor,
	surface,
	event,
}: {
	editor: Editor
	surface: DrawingSurface
	event: PointerEvent
}): Gesture {
	const container = editor.getContainer()
	const svg = document.createElementNS(svgNs, 'svg')
	const path = document.createElementNS(svgNs, 'path')
	Object.assign(svg.style, {
		position: 'absolute',
		inset: '0',
		width: '100%',
		height: '100%',
		pointerEvents: 'none',
		zIndex: '1',
	})
	svg.setAttribute('aria-hidden', 'true')
	path.setAttribute('fill', 'var(--pen)')
	svg.append(path)
	container.append(svg)
	const origin = editor.pageToViewport({ x: 0, y: 0 })
	const zoom = editor.getZoomLevel()
	path.setAttribute('transform', `translate(${origin.x} ${origin.y}) scale(${zoom})`)
	let toLocal: (point: Point) => Point = (point) => editor.screenToPage(point)
	if (surface.kind === 'note') {
		const rect = surface.pad.getBoundingClientRect()
		const outer = container.getBoundingClientRect()
		Object.assign(svg.style, {
			inset: 'auto',
			left: `${rect.left - outer.left}px`,
			top: `${rect.top - outer.top}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			overflow: 'hidden',
		})
		svg.setAttribute('viewBox', `0 0 ${NOTE_INK_WIDTH} ${NOTE_INK_HEIGHT}`)
		path.removeAttribute('transform')
		path.setAttribute('fill', getComputedStyle(surface.pad).color)
		toLocal = ({ x, y }) => ({
			x: Math.max(0, Math.min(NOTE_INK_WIDTH, ((x - rect.left) / rect.width) * NOTE_INK_WIDTH)),
			y: Math.max(0, Math.min(NOTE_INK_HEIGHT, ((y - rect.top) / rect.height) * NOTE_INK_HEIGHT)),
		})
	}
	const pen = event.pointerType === 'pen'
	const sample = (input: PointerEvent) => {
		const { x, y } = toLocal(clientPoint(input))
		return { x, y, z: pen ? input.pressure : 0.5 }
	}
	const points: InkStroke = [sample(event)]
	path.setAttribute('d', strokePath({ points }))
	return { kind: 'draw', surface, pointerId: event.pointerId, pen, points, sample, svg, path }
}

function finishDrawing({
	editor,
	gesture,
}: {
	editor: Editor
	gesture: Extract<Gesture, { kind: 'draw' }>
}) {
	const { surface, points } = gesture
	if (surface.kind === 'canvas') {
		finishArrow({ editor, points })
	} else {
		const note = editor.getShape(surface.id)
		if (note?.type !== 'margin-note' || note.isLocked) return
		editor.markHistoryStoppingPoint('write in note')
		editor.updateShape({
			id: note.id,
			type: note.type,
			props: { strokes: [...note.props.strokes, points] },
		})
	}
}

export function installInkTools(editor: Editor) {
	const container = editor.getContainer()
	let gesture: Gesture | undefined
	let frame = 0
	const isDrawingTool = () => editor.isIn(InkArrowTool.id) || editor.isIn(HandwriteTool.id)
	const release = () => {
		const current = gesture
		gesture = undefined
		cancelAnimationFrame(frame)
		frame = 0
		if (!current) return
		if (current.kind === 'draw') current.svg.remove()
		if (container.hasPointerCapture(current.pointerId))
			container.releasePointerCapture(current.pointerId)
		if (!editor.isDisposed && editor.getInstanceState().isPenMode)
			editor.updateInstanceState({ isPenMode: false })
	}
	const consume = (event: Event) => {
		event.preventDefault()
		event.stopPropagation()
	}
	const down = (event: PointerEvent) => {
		if (!onCanvas(event.target) || event.button !== 0) return
		if (event.pointerType === 'pen') penUsed = true
		if (gesture) {
			if (gesture.kind === 'draw' && gesture.pen) consume(event)
			else if (event.pointerType === 'touch') release()
			return
		}
		if (
			!event.isPrimary ||
			!isDrawingTool() ||
			editor.getIsReadonly() ||
			editor.inputs.getIsPanning()
		)
			return
		const origin = clientPoint(event)
		if (event.pointerType === 'touch' && penUsed) {
			gesture = { kind: 'pan', pointerId: event.pointerId, origin, last: origin, moved: false }
		} else if (editor.isIn(InkArrowTool.id)) {
			gesture = beginDrawing({ editor, surface: { kind: 'canvas' }, event })
		} else {
			const noteId = editor.getOnlySelectedShapeId()
			const pad = event.target instanceof Element ? event.target.closest('[data-note-ink]') : null
			if (noteId && pad?.getAttribute('data-note-ink') === noteId) {
				if (editor.getShape(noteId)?.isLocked) return
				gesture = beginDrawing({ editor, surface: { kind: 'note', id: noteId, pad }, event })
			} else {
				gesture = { kind: 'place-note', pointerId: event.pointerId, origin }
			}
		}
		editor.getContainer().focus({ preventScroll: true })
		editor.stopCameraAnimation()
		if (event.pointerType === 'pen') editor.updateInstanceState({ isPenMode: true })
		container.setPointerCapture(event.pointerId)
		consume(event)
	}
	const move = (event: PointerEvent) => {
		if (!gesture) return
		if (gesture.pointerId !== event.pointerId) {
			if (gesture.kind === 'draw' && gesture.pen) consume(event)
			return
		}
		consume(event)
		if (gesture.kind === 'pan') {
			const point = clientPoint(event)
			if (!gesture.moved && Math.hypot(point.x - gesture.origin.x, point.y - gesture.origin.y) < 5)
				return
			const { x, y, z } = editor.getCamera()
			editor.setCamera({
				x: x + (point.x - gesture.last.x) / z,
				y: y + (point.y - gesture.last.y) / z,
				z,
			})
			gesture.last = point
			gesture.moved = true
		}
		if (gesture.kind !== 'draw') return
		const current = gesture
		const coalesced = event.getCoalescedEvents?.() ?? []
		for (const input of coalesced.length ? coalesced : [event]) {
			const sample = current.sample(input)
			const last = current.points.at(-1) ?? current.points[0]
			if (Math.hypot(sample.x - last.x, sample.y - last.y) >= 0.65) current.points.push(sample)
		}
		if (!frame)
			frame = requestAnimationFrame(() => {
				frame = 0
				current.path.setAttribute('d', strokePath({ points: current.points }))
			})
	}
	const up = (event: PointerEvent) => {
		const current = gesture
		if (!current) {
			if (event.pointerType === 'pen' && editor.getInstanceState().isPenMode)
				queueMicrotask(() => {
					if (!gesture && !editor.isDisposed) editor.updateInstanceState({ isPenMode: false })
				})
			return
		}
		if (current.pointerId !== event.pointerId) {
			if (current.kind === 'draw' && current.pen) consume(event)
			return
		}
		consume(event)
		release()
		if (!isDrawingTool() || editor.getIsReadonly()) return
		if (current.kind === 'draw') {
			if (!editor.isIn(current.surface.kind === 'note' ? HandwriteTool.id : InkArrowTool.id)) return
			const sample = current.sample(event)
			const last = current.points.at(-1) ?? current.points[0]
			if (sample.x !== last.x || sample.y !== last.y) current.points.push({ ...sample, z: last.z })
			finishDrawing({ editor, gesture: current })
		} else if (current.kind === 'place-note') {
			placeNote({ editor, point: current.origin })
		} else if (!current.moved) {
			const target = targetAt({ editor, point: current.last })
			if (target) editor.select(target.id)
			else if (editor.isIn(HandwriteTool.id)) placeNote({ editor, point: current.last })
			else editor.selectNone()
		}
	}
	const cancel = (event: PointerEvent) => {
		if (gesture?.pointerId === event.pointerId) release()
	}
	const palm = (event: TouchEvent) => {
		if (gesture?.kind === 'draw' && gesture.pen) consume(event)
	}
	const escape = (event: KeyboardEvent) => {
		if (event.key === 'Escape') release()
	}
	const listeners = new AbortController()
	const options = { capture: true, passive: false, signal: listeners.signal }
	container.addEventListener('pointerdown', down, options)
	container.addEventListener('pointermove', move, options)
	container.addEventListener('pointerup', up, options)
	container.addEventListener('pointercancel', cancel, options)
	container.addEventListener('lostpointercapture', cancel, options)
	container.addEventListener('touchstart', palm, options)
	container.addEventListener('touchmove', palm, options)
	container.addEventListener('touchend', palm, options)
	container.addEventListener('touchcancel', palm, options)
	container.addEventListener('keydown', escape, options)
	return () => {
		listeners.abort()
		release()
	}
}
