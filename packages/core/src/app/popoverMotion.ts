import { useCallback, useEffect, useRef, useState } from 'react'
import { motionNow } from './dialogMotion'

/*
 * Prototype: a popover that opens out of the control it came from on a well-damped spring, and
 * settles back into it when it leaves. On by default, behind a switch that can turn it off to
 * compare with the plain pop-in in the same build. Transform and opacity only, through the Web
 * Animations API, so it runs on the compositor and never touches layout or inherited properties.
 */

const STORAGE_KEY = 'margin.fluidPopoverMotion'
const URL_FLAG = 'fluidPopovers'

/** `?fluidPopovers=1` (or `=0`) wins for that window, for captures; otherwise the saved switch. */
export function fluidPopoverMotion(): boolean {
	try {
		const flag = new URLSearchParams(window.location.search).get(URL_FLAG)
		if (flag !== null) return flag === '1'
		return window.localStorage.getItem(STORAGE_KEY) !== '0'
	} catch {
		return true
	}
}

/** Flips the saved switch; it applies from the next popover opened. Returns the new state. */
export function toggleFluidPopoverMotion(): boolean {
	const next = !fluidPopoverMotion()
	try {
		window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
	} catch {
		// No storage (private window): the switch simply stays as it was.
	}
	return next
}

/** Apple's two-parameter spring: damping ratio (1 = no overshoot) and response (period, seconds). */
export const ENTER_SPRING = { dampingRatio: 0.82, response: 0.27 }
/** Scale the popover opens out from, and returns to as it leaves. */
export const FROM_SCALE = 0.94
/** Pixels the popover starts nudged toward its anchor, along the side it opened on. */
export const TOWARD_ANCHOR_PX = 4
export const OPACITY_IN_MS = 100
export const EXIT_MS = 120
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const EASE_IN = 'cubic-bezier(0.42, 0, 1, 1)'

/** Unit step response of a spring at rest: 0 at t = 0, settling on 1. */
export function springAt(t: number, { dampingRatio: z, response }: typeof ENTER_SPRING) {
	const w0 = (2 * Math.PI) / response
	if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t)
	const wd = w0 * Math.sqrt(1 - z * z)
	return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t))
}

/**
 * The spring as a CSS `linear()` easing. It runs until it stays within `rest` of the target (0.1% of
 * the travel, far below a pixel), sampled every `stepMs`, so the last frame lands exactly on 1.
 */
export function springEasing(spring = ENTER_SPRING, { stepMs = 8, rest = 0.001 } = {}) {
	let settled = 0
	for (let ms = 2000; ms > 0; ms--)
		if (Math.abs(1 - springAt(ms / 1000, spring)) > rest) {
			settled = ms + 1
			break
		}
	const steps = Math.max(2, Math.ceil(settled / stepMs))
	const points = Array.from({ length: steps + 1 }, (_, i) =>
		i === steps ? 1 : springAt((settled * i) / steps / 1000, spring),
	)
	return {
		easing: `linear(${points.map((p) => +p.toFixed(4)).join(', ')})`,
		durationMs: settled,
		overshoot: Math.max(...points) - 1,
	}
}

let enterCurve: ReturnType<typeof springEasing> | undefined
/** Sampled on first use, so a window with the switch off never computes it. */
const enterSpring = () => (enterCurve ??= springEasing())

type Side = 'top' | 'bottom' | 'left' | 'right'
const sideOf = (el: HTMLElement): Side => (el.dataset.side as Side | undefined) ?? 'bottom'

/** The nudge toward the anchor: a popover below its words starts a few pixels up, and so on. */
function towardAnchor(side: Side, amount: number) {
	if (side === 'bottom') return { x: 0, y: -amount }
	if (side === 'top') return { x: 0, y: amount }
	if (side === 'right') return { x: -amount, y: 0 }
	return { x: amount, y: 0 }
}

const transformOf = (scale: number, x: number, y: number) =>
	`translate(${x}px, ${y}px) scale(${scale})`

/** Where the popover is right now, mid-animation or not (its presentation value). */
function presented(el: HTMLElement) {
	const style = getComputedStyle(el)
	const m = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform)
	return { scale: m.a, x: m.e, y: m.f, opacity: Number(style.opacity) }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))

/**
 * Opens the popover out of the point it came from: the click (or the words) along the edge of the
 * anchor that faces it, so a popover below its words unfurls downward and one flipped above unfurls
 * upward. Measured from the positioning wrapper, which never carries the animation's transform.
 */
function placeOrigin(el: HTMLElement, anchor: DOMRect, point: { x: number; y: number }) {
	const box = (el.parentElement ?? el).getBoundingClientRect()
	const width = el.offsetWidth,
		height = el.offsetHeight
	const side = sideOf(el)
	const across = (from: number, size: number, at: number, lo: number, hi: number) =>
		clamp(clamp(at, lo, hi) - from, 0, size)
	const x =
		side === 'left'
			? anchor.left - box.left
			: side === 'right'
				? anchor.right - box.left
				: across(box.left, width, point.x, anchor.left, anchor.right)
	const y =
		side === 'top'
			? anchor.top - box.top
			: side === 'bottom'
				? anchor.bottom - box.top
				: across(box.top, height, point.y, anchor.top, anchor.bottom)
	el.style.transformOrigin = `${x}px ${y}px`
}

/**
 * Open and close motion for one popover. `request` changes each time the popover is asked to open;
 * `target` names what it points at (its words). Asked again while leaving, it comes back from where
 * it is; pointed at other words, a fresh popover opens at the new place. Keyboard opening and
 * closing stay instant, as the dialogs do (dialogMotion.ts), so focus and typing never wait.
 */
export function usePopoverMotion({
	request,
	target,
	origin,
	close,
	freeze,
}: {
	request: unknown
	target: string
	origin: () => { anchor: DOMRect | null; point: { x: number; y: number } }
	close: () => void
	/** Called as it starts to leave, so the popover can keep showing what it showed until gone. */
	freeze: () => void
}) {
	const [fluid] = useState(fluidPopoverMotion)
	const element = useRef<HTMLElement | null>(null)
	const running = useRef<Animation[]>([])
	const leaving = useRef(false)
	const latest = useRef({ origin, close, freeze })
	latest.current = { origin, close, freeze }

	/** Starts the next animations first, then drops the old ones, so no frame shows the resting state. */
	const replace = useCallback((next: Animation[]) => {
		const old = running.current
		running.current = next
		for (const animation of old) animation.cancel()
	}, [])

	const enter = useCallback(
		(from: { scale: number; x: number; y: number; opacity: number } | null) => {
			const el = element.current
			if (!el) return
			const { anchor, point } = latest.current.origin()
			if (!from) placeOrigin(el, anchor ?? new DOMRect(point.x, point.y, 0, 0), point)
			const reduce = reducedMotion()
			const nudge = towardAnchor(sideOf(el), reduce ? 0 : TOWARD_ANCHOR_PX)
			const start = from ?? { scale: FROM_SCALE, ...nudge, opacity: 0 }
			const next: Animation[] = []
			if (!reduce && (start.scale !== 1 || start.x !== 0 || start.y !== 0)) {
				const { durationMs, easing } = enterSpring()
				next.push(
					el.animate(
						[{ transform: transformOf(start.scale, start.x, start.y) }, { transform: 'none' }],
						{ duration: durationMs, easing },
					),
				)
			}
			if (start.opacity < 1)
				next.push(
					el.animate([{ opacity: start.opacity }, { opacity: 1 }], {
						duration: OPACITY_IN_MS * (1 - start.opacity),
						easing: EASE_OUT,
					}),
				)
			replace(next)
		},
		[replace],
	)

	/** Radix has placed the popover (before its first paint): open it out of its anchor. */
	const onPlaced = useCallback(() => {
		if (motionNow('instant') === 'animated') enter(null)
	}, [enter])

	const requestClose = useCallback(() => {
		const el = element.current
		if (!fluid || !el || motionNow('instant') === 'instant') return latest.current.close()
		if (leaving.current) return
		leaving.current = true
		latest.current.freeze()
		// The leaving popover no longer takes clicks: the next press goes to whatever is under it.
		el.style.pointerEvents = 'none'
		const now = presented(el)
		const reduce = reducedMotion()
		const nudge = towardAnchor(sideOf(el), reduce ? 0 : TOWARD_ANCHOR_PX)
		// Interrupted mid-open, it leaves from where it is, in the share of the time it has left to go.
		const left = Math.max(now.opacity, reduce ? 0 : (now.scale - FROM_SCALE) / (1 - FROM_SCALE))
		const options = {
			duration: EXIT_MS * clamp(left, 0.35, 1),
			easing: EASE_IN,
			fill: 'forwards' as const,
		}
		const next = [el.animate([{ opacity: now.opacity }, { opacity: 0 }], options)]
		if (!reduce)
			next.push(
				el.animate(
					[
						{ transform: transformOf(now.scale, now.x, now.y) },
						{ transform: transformOf(FROM_SCALE, nudge.x, nudge.y) },
					],
					options,
				),
			)
		replace(next)
		const last = next[0]!
		last.finished.then(
			() => {
				if (leaving.current && running.current.includes(last)) latest.current.close()
			},
			() => undefined,
		)
	}, [fluid, replace])

	const shown = useRef({ request, target })
	useEffect(() => {
		const el = element.current
		const before = shown.current
		if (!fluid || !el || request === before.request) return
		shown.current = { request, target }
		const wasLeaving = leaving.current
		if (!wasLeaving && target === before.target) return
		leaving.current = false
		el.style.pointerEvents = ''
		if (motionNow('instant') === 'instant') return replace([])
		if (target === before.target) return enter(presented(el))
		// Other words: hide until the popover has moved to them, then open out from there.
		replace([el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1e6 })])
		let frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => enter(null))
		})
		return () => cancelAnimationFrame(frame)
	}, [fluid, request, target, enter, replace])

	const ref = useCallback((el: HTMLElement | null) => {
		element.current = el
	}, [])

	return {
		requestClose,
		/** Spread on the popover content. `onPlaced` is Radix Popper's, which Popover passes through. */
		contentProps: fluid ? { ref, 'data-fluid': '', onPlaced } : {},
	}
}
