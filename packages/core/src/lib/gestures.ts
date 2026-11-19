export interface GesturePoint {
	pointerId: number
	x: number
	y: number
}

/**
 * A finger held still on one spot. It fires once the hold time passes, and is cancelled by moving
 * past the slop, lifting early or a second finger, so pans, pinches and taps stay with tldraw.
 * `onPressStart` and `onPressEnd` bracket the whole touch, held or not, for press feedback.
 */
export function createLongPress({
	delay,
	slop,
	onLongPress,
	onPressStart,
	onPressEnd,
}: {
	delay: number
	slop: number
	onLongPress: (point: GesturePoint) => void
	onPressStart?: (point: GesturePoint) => void
	onPressEnd?: () => void
}) {
	let pending: (GesturePoint & { timer: ReturnType<typeof setTimeout> }) | null = null
	let firedFor: number | null = null
	let pressing = false
	const end = () => {
		if (!pressing) return
		pressing = false
		onPressEnd?.()
	}
	const cancel = () => {
		if (pending) clearTimeout(pending.timer)
		pending = null
		end()
	}
	return {
		down(point: GesturePoint) {
			if (pending) return cancel()
			end()
			firedFor = null
			const timer = setTimeout(() => {
				pending = null
				firedFor = point.pointerId
				onLongPress(point)
			}, delay)
			pending = { ...point, timer }
			pressing = true
			onPressStart?.(point)
		},
		move(point: GesturePoint) {
			if (pending?.pointerId !== point.pointerId) return
			if (Math.hypot(point.x - pending.x, point.y - pending.y) > slop) cancel()
		},
		/** Ends the press; true when it had already fired, so the caller can swallow the release. */
		up(pointerId: number) {
			if (pending?.pointerId === pointerId) cancel()
			const fired = firedFor === pointerId
			firedFor = null
			if (fired) end()
			return fired
		},
		cancel,
	}
}

/**
 * Two taps of a finger or pencil close together in time and place. A mouse is left alone: its
 * double click arrives as `dblclick`.
 */
export function createDoubleTap({
	onDoubleTap,
	interval = 450,
	slop = 24,
}: {
	onDoubleTap: () => void
	interval?: number
	slop?: number
}) {
	let last: { time: number; x: number; y: number } | null = null
	return (event: { pointerType: string; timeStamp: number; clientX: number; clientY: number }) => {
		if (event.pointerType === 'mouse') return
		const tap = { time: event.timeStamp, x: event.clientX, y: event.clientY }
		if (
			last &&
			tap.time - last.time <= interval &&
			Math.hypot(tap.x - last.x, tap.y - last.y) <= slop
		) {
			last = null
			onDoubleTap()
		} else last = tap
	}
}
