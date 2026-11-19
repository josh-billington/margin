/**
 * The intro's motion vocabulary. It plays once, so it can take its time, but every arrival starts
 * moving at once (ease-out) and settles without overshoot. Everything here is WAAPI on transform,
 * opacity and blur, so nothing is added to the document's stylesheets.
 */

/** Arrivals: a quick start and a long, quiet settle, no overshoot. */
export const SETTLE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** A hand moving across the page: eases in and out, for ink and the closing dissolve. */
export const PEN = 'cubic-bezier(0.65, 0, 0.35, 1)'
/** One letter of handwriting: gentler than PEN, so the nib never quite stops mid-letter. */
export const WRITE = 'cubic-bezier(0.45, 0, 0.55, 1)'

/** Reduced motion: things appear finished, with short opacity fades and no movement. */
export const REDUCED_FADE = 260

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

type Timing = { duration: number; delay?: number; easing?: string }

/** Anything a step started that a later step can complete at once. */
export type Finishable = { finish: () => void; cancel: () => void }

export function play(
	target: Element | null | undefined,
	keyframes: Keyframe[],
	{ duration, delay = 0, easing = SETTLE }: Timing,
): Animation | null {
	// `both` holds the first frame through the delay, so nothing shows before its turn.
	return target ? target.animate(keyframes, { duration, delay, easing, fill: 'both' }) : null
}

const cssName = (property: string) => property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/**
 * Moves an element to `to` from wherever it is on screen now, mid-animation included, and replaces
 * whatever was running on it. Interrupting a transition never makes anything jump.
 */
export function retarget(
	target: Element | null | undefined,
	to: Record<string, string | number>,
	timing: Timing,
): Animation | null {
	if (!target) return null
	const style = getComputedStyle(target)
	const from = Object.fromEntries(
		Object.keys(to).map((key) => [key, style.getPropertyValue(cssName(key))]),
	)
	for (const animation of target.getAnimations()) animation.cancel()
	return play(target, [from, to], timing)
}

/** Drives `draw(progress)` from 0 to 1 on animation frames, for motion WAAPI cannot express. */
export function drive({
	duration,
	delay = 0,
	ease,
	draw,
}: {
	duration: number
	delay?: number
	ease: (t: number) => number
	draw: (progress: number) => void
}): Finishable {
	let frame = 0
	let start: number | null = null
	const tick = (now: number) => {
		start ??= now + delay
		const t = Math.min(1, Math.max(0, (now - start) / duration))
		draw(ease(t))
		if (t < 1) frame = requestAnimationFrame(tick)
	}
	draw(0)
	frame = requestAnimationFrame(tick)
	return {
		finish: () => {
			cancelAnimationFrame(frame)
			draw(1)
		},
		cancel: () => cancelAnimationFrame(frame),
	}
}

/** Sine ease-in-out: a pen speeding up out of the start and slowing into the end. */
export const easeInOutSine = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

/** Collects what one step started, so the next step can finish it before it begins. */
export class Steps {
	private running: Finishable[] = []
	add(item: Finishable | null) {
		if (item) this.running.push(item)
		return item
	}
	finish() {
		for (const item of this.running.splice(0)) item.finish()
	}
	cancel() {
		for (const item of this.running.splice(0)) item.cancel()
	}
}
