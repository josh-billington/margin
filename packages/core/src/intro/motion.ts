/**
 * The intro's motion vocabulary. It plays once, so it can take its time, but its arrival starts
 * moving at once (ease-out) and settles without overshoot. Everything here is WAAPI on transform,
 * opacity and blur, so nothing is added to the document's stylesheets.
 */

/** Arrivals: a quick start and a long, quiet settle, no overshoot. */
export const SETTLE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Eases in and out, for the closing dissolve. */
export const PEN = 'cubic-bezier(0.65, 0, 0.35, 1)'

/** Reduced motion: things appear finished, with short opacity fades and no movement. */
export const REDUCED_FADE = 260

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

type Timing = { duration: number; delay?: number; easing?: string }

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
