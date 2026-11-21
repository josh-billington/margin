import { StateNode } from 'tldraw'
import type { Editor } from 'tldraw'
import type { InkPoint, InkStroke } from '@shared/study/types'
import { finishStroke, inkTargetAt } from './finishStroke'
import { strokePath } from './stroke'

export class DrawTool extends StateNode {
	static override id = 'margin-draw'
	override onEnter() {
		this.editor.stopCameraAnimation()
		this.editor.setCursor({ type: 'cross', rotation: 0 })
	}
	override onCancel() {
		this.editor.setCurrentTool('select')
	}
}

const svgNs = 'http://www.w3.org/2000/svg'
const PAN_SLOP_PX = 5
const SAMPLE_SPACING_PX = 0.65
const clientPoint = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY })
type Point = ReturnType<typeof clientPoint>

type Gesture =
	| {
			kind: 'draw'
			pointerId: number
			pen: boolean
			tool: string
			zoom: number
			startHit: ReturnType<typeof inkTargetAt>
			containsInStartNote: (point: Point) => boolean
			staysInStartNote: boolean
			points: InkStroke
			sample: (event: PointerEvent) => InkPoint
			svg: SVGSVGElement
			path: SVGPathElement
	  }
	| { kind: 'pan'; pointerId: number; origin: Point; last: Point; moved: boolean }

type Drawing = Extract<Gesture, { kind: 'draw' }>

function beginDrawing({ editor, event }: { editor: Editor; event: PointerEvent }): Drawing {
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
	const pen = event.pointerType === 'pen'
	const sample = (input: PointerEvent) => {
		const { x, y } = editor.screenToPage(clientPoint(input))
		return { x, y, z: pen ? input.pressure : 0.5 }
	}
	const points: InkStroke = [sample(event)]
	const startHit = inkTargetAt({ editor, point: points[0] })
	let containsInStartNote: (point: Point) => boolean = () => false
	if (startHit?.kind === 'note') {
		const bounds = editor.getShapeGeometry(startHit.shape).bounds
		const toNote = editor.getShapePageTransform(startHit.shape).clone().invert()
		containsInStartNote = (point) => bounds.containsPoint(toNote.applyToPoint(point))
	}
	path.setAttribute('d', strokePath({ points }))
	return {
		kind: 'draw',
		pointerId: event.pointerId,
		pen,
		tool: editor.getCurrentToolId(),
		zoom,
		startHit,
		containsInStartNote,
		staysInStartNote: containsInStartNote(points[0]),
		points,
		sample,
		svg,
		path,
	}
}

export function installInkTools(editor: Editor) {
	const container = editor.getContainer()
	let gesture: Gesture | undefined
	let frame = 0
	let penUsed = false
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
		const pen = event.pointerType === 'pen'
		const touch = event.pointerType === 'touch'
		if (!(event.target instanceof Element) || event.button !== 0) return
		if (event.target.closest('button, input, [role="menu"], [role="dialog"]')) return
		if (pen) penUsed = true
		if (gesture) {
			if (gesture.kind === 'draw' && gesture.pen) consume(event)
			else if (touch || pen) release()
			if (!pen || gesture) return
		}
		if (!event.isPrimary || editor.inputs.getIsPanning() || editor.inputs.getIsPinching()) return
		const tool = editor.getCurrentToolId()
		const editable = event.target.closest('textarea, [contenteditable="true"]')
		const drawing =
			!editor.getIsReadonly() &&
			(tool === DrawTool.id || (pen && (tool === 'select' || tool === 'hand')))
		if (editable && !(drawing && editable.closest('.margin-note'))) return
		if (drawing) {
			editor.stopCameraAnimation()
			gesture = beginDrawing({ editor, event })
			editor.setEditingShape(null)
		} else if (touch && penUsed && tool === 'select') {
			const origin = clientPoint(event)
			gesture = { kind: 'pan', pointerId: event.pointerId, origin, last: origin, moved: false }
			editor.stopCameraAnimation()
		} else {
			return
		}
		editor.getContainer().focus({ preventScroll: true })
		if (pen) editor.updateInstanceState({ isPenMode: true })
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
			if (
				!gesture.moved &&
				Math.hypot(point.x - gesture.origin.x, point.y - gesture.origin.y) < PAN_SLOP_PX
			)
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
			current.staysInStartNote &&= current.containsInStartNote(sample)
			const last = current.points.at(-1) ?? current.points[0]
			if (Math.hypot(sample.x - last.x, sample.y - last.y) * current.zoom >= SAMPLE_SPACING_PX)
				current.points.push(sample)
		}
		if (!frame)
			frame = requestAnimationFrame(() => {
				frame = 0
				current.path.setAttribute('d', strokePath({ points: current.points }))
			})
	}
	const resetNativePenMode = (event: PointerEvent) => {
		if (event.pointerType === 'pen' && editor.getInstanceState().isPenMode)
			queueMicrotask(() => {
				if (!gesture && !editor.isDisposed) editor.updateInstanceState({ isPenMode: false })
			})
	}
	const up = (event: PointerEvent) => {
		const current = gesture
		if (!current) {
			resetNativePenMode(event)
			return
		}
		if (current.pointerId !== event.pointerId) {
			if (current.kind === 'draw' && current.pen) consume(event)
			return
		}
		consume(event)
		release()
		if (current.kind === 'draw') {
			if (editor.getCurrentToolId() !== current.tool || editor.getIsReadonly()) return
			const sample = current.sample(event)
			const last = current.points.at(-1) ?? current.points[0]
			if (sample.x !== last.x || sample.y !== last.y) current.points.push({ ...sample, z: last.z })
			finishStroke({
				editor,
				points: current.points,
				startHit: current.startHit,
				zoom: current.zoom,
				staysInStartNote: current.staysInStartNote && current.containsInStartNote(sample),
			})
		} else if (!current.moved && editor.isIn('select')) {
			const target = editor.getShapeAtPoint(editor.screenToPage(current.origin), {
				hitInside: true,
			})
			if (target) editor.select(target.id)
			else editor.selectNone()
		}
	}
	const cancel = (event: PointerEvent) => {
		if (gesture?.pointerId === event.pointerId) release()
		else if (!gesture) resetNativePenMode(event)
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
