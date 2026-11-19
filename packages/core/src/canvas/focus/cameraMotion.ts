import type { Editor } from 'tldraw'
import { CAMERA_MS } from './camera'
import type { Camera } from './camera'

/**
 * Camera moves for focus and reveal. A fresh move is a 280ms ease-out. A move that interrupts one
 * still running (Esc while F is zooming in) becomes a critically damped spring that starts from the
 * camera's current position and velocity, so a reversal decelerates and turns instead of jumping
 * to full speed the other way. Like tldraw's own camera animation, it moves the viewport's page
 * bounds (left, top, width) and leaves any other camera input in charge: a wheel, a pointer press,
 * or any other camera move stops it where it is.
 */

/**
 * Seconds, critically damped (no overshoot): Apple's value for moving and repositioning. At 0.3s
 * the turn after Esc at 100ms takes a single frame; at 0.4s it decelerates over two, then returns.
 */
export const SPRING_RESPONSE = 0.4
const OMEGA = (2 * Math.PI) / SPRING_RESPONSE

/** Viewport page bounds as [left, top, width], in page units. */
export type Viewport = readonly number[]
/** One viewport axis: where it is, and how fast it moves (page units per second). */
export interface Axis {
	at: number
	velocity: number
}
export type Motion =
	| { kind: 'ease'; from: Viewport; to: Viewport; elapsed: number; duration: number }
	| { kind: 'spring'; axes: readonly Axis[]; to: Viewport }

export const easeMotion = (from: Viewport, to: Viewport, duration = CAMERA_MS): Motion => ({
	kind: 'ease',
	from,
	to,
	elapsed: 0,
	duration,
})

/** Position and velocity of each axis now. easeOutCubic: 1 − (1 − p)³, so velocity ∝ 3(1 − p)². */
export function axesOf(motion: Motion): Axis[] {
	if (motion.kind === 'spring') return [...motion.axes]
	const p = Math.min(1, motion.elapsed / motion.duration)
	return motion.from.map((from, i) => {
		const distance = (motion.to[i] ?? from) - from
		return {
			at: from + distance * (1 - (1 - p) ** 3),
			velocity: (distance * 3 * (1 - p) ** 2) / (motion.duration / 1000),
		}
	})
}

/** A new target mid-move: carry the current velocity into a spring toward it. */
export const retarget = (motion: Motion, to: Viewport): Motion => ({
	kind: 'spring',
	axes: axesOf(motion),
	to,
})

/** Exact critically damped step: x(t) = (d + (v₀ + ωd)t)e^(−ωt) about the target. */
export function advance(motion: Motion, ms: number): Motion {
	if (motion.kind === 'ease')
		return { ...motion, elapsed: Math.min(motion.duration, motion.elapsed + ms) }
	const t = ms / 1000,
		decay = Math.exp(-OMEGA * t)
	return {
		...motion,
		axes: motion.axes.map(({ at, velocity }, i) => {
			const to = motion.to[i] ?? at
			const d = at - to,
				b = velocity + OMEGA * d
			return { at: to + (d + b * t) * decay, velocity: (velocity - OMEGA * b * t) * decay }
		}),
	}
}

/** Done once every axis is within a fraction of a screen pixel of the target and nearly still. */
export function settled(motion: Motion, screenPerPage: number) {
	if (motion.kind === 'ease') return motion.elapsed >= motion.duration
	return motion.axes.every(
		({ at, velocity }, i) =>
			Math.abs(at - (motion.to[i] ?? at)) * screenPerPage < 0.25 &&
			Math.abs(velocity) * screenPerPage < 10,
	)
}

const running = new WeakMap<Editor, { motion: Motion; stop: () => void }>()

const viewportWidth = (editor: Editor) => editor.getViewportScreenBounds().w
function currentViewport(editor: Editor): Viewport {
	const bounds = editor.getViewportPageBounds()
	return [bounds.minX, bounds.minY, bounds.w]
}

/** Animates the camera to `camera`, re-targeting a move already running without a velocity cut. */
export function animateCamera(editor: Editor, camera: Camera) {
	const to: Viewport = [-camera.x, -camera.y, viewportWidth(editor) / camera.z]
	const live = running.get(editor)
	live?.stop()
	const entry = {
		motion: live ? retarget(live.motion, to) : easeMotion(currentViewport(editor), to),
		stop: () => {},
	}
	let applying = false
	const apply = (viewport: Viewport) => {
		const [left = 0, top = 0, width = 1] = viewport
		applying = true
		try {
			editor.setCamera({ x: -left, y: -top, z: viewportWidth(editor) / width }, { immediate: true })
		} finally {
			applying = false
		}
	}
	const tick = (ms: number) => {
		entry.motion = advance(entry.motion, ms)
		if (settled(entry.motion, editor.getZoomLevel())) {
			entry.stop()
			apply(to)
		} else apply(axesOf(entry.motion).map((axis) => axis.at))
	}
	// Every other camera move (and FocusLayer's wheel and pointer interrupts) stops this one.
	const interrupted = () => {
		if (!applying) entry.stop()
	}
	entry.stop = () => {
		editor.off('tick', tick)
		editor.off('stop-camera-animation', interrupted)
		if (running.get(editor) === entry) running.delete(editor)
	}
	editor.stopCameraAnimation()
	editor.on('tick', tick)
	editor.on('stop-camera-animation', interrupted)
	running.set(editor, entry)
}

/** Ends any running move where it is. */
export function stopCamera(editor: Editor) {
	running.get(editor)?.stop()
}
