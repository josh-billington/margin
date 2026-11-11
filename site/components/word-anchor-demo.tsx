'use client'
import React from 'react'

type Point = { x: number; y: number }

const HEAD_LENGTH = 15
const HEAD_HALF_WIDTH = 6.5

/** Quadratic arc from the note to just under the target word, with a filled head (SPEC §2.3). */
function arrowGeometry(from: Point, to: Point) {
	const dx = to.x - from.x
	const dy = to.y - from.y
	const length = Math.hypot(dx, dy) || 1
	// Gentle arc: bend the control point off the chord, a quarter of its length.
	const bend = 0.22 * length
	const control = {
		x: (from.x + to.x) / 2 + (dy / length) * bend,
		y: (from.y + to.y) / 2 - (dx / length) * bend,
	}
	const tx = to.x - control.x
	const ty = to.y - control.y
	const tl = Math.hypot(tx, ty) || 1
	const ux = tx / tl
	const uy = ty / tl
	const base = { x: to.x - ux * HEAD_LENGTH, y: to.y - uy * HEAD_LENGTH }
	const line = `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${base.x.toFixed(1)} ${base.y.toFixed(1)}`
	const head = [
		to,
		{ x: base.x - uy * HEAD_HALF_WIDTH, y: base.y + ux * HEAD_HALF_WIDTH },
		{ x: base.x + uy * HEAD_HALF_WIDTH, y: base.y - ux * HEAD_HALF_WIDTH },
	]
		.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
		.join(' ')
	return { line, head }
}

/**
 * The page's one live thing: a real reflow of Psalm 125:1, matching the demo study in the
 * screenshots. Drag the width and the verse rewraps; the note's arrow is bound to the word
 * "abideth", so it follows the word, not the screen.
 */
export function WordAnchorDemo() {
	const [width, setWidth] = React.useState(100)
	const [arrow, setArrow] = React.useState<{ line: string; head: string } | null>(null)
	const stage = React.useRef<HTMLDivElement>(null)
	const note = React.useRef<HTMLParagraphElement>(null)
	const target = React.useRef<HTMLSpanElement>(null)

	const measure = React.useCallback(() => {
		const s = stage.current?.getBoundingClientRect()
		const n = note.current?.getBoundingClientRect()
		const t = target.current?.getBoundingClientRect()
		if (!s || !n || !t) return
		const from = { x: n.left - s.left + Math.min(36, n.width * 0.2), y: n.top - s.top - 8 }
		const to = { x: t.left - s.left + t.width * 0.45, y: t.bottom - s.top + 7 }
		setArrow(arrowGeometry(from, to))
	}, [])

	React.useLayoutEffect(measure, [measure, width])
	React.useEffect(() => {
		const observer = new ResizeObserver(measure)
		if (stage.current) observer.observe(stage.current)
		document.fonts?.ready.then(measure)
		return () => observer.disconnect()
	}, [measure])

	return (
		<div data-ui className="bg-night rounded-[14px] p-5 sm:p-8">
			<div ref={stage} className="relative">
				<div className="relative z-10 max-w-full" style={{ width: `${width}%` }}>
					<p className="text-muted-foreground text-[13px] font-semibold">Psalms 125:1 · KJV</p>
					<p className="text-scripture mt-3 text-[19px] leading-[1.6] sm:text-[22px]">
						<sup className="text-muted-foreground mr-1 text-[0.55em] font-medium">1</sup>They that{' '}
						<b className="text-sky font-semibold">trust</b> in the LORD shall be as{' '}
						<b className="text-amber font-semibold">mount Zion,</b> which{' '}
						<b className="text-violet font-semibold">cannot be removed,</b> but{' '}
						<b className="text-violet font-semibold">
							<span ref={target}>abideth</span> for ever.
						</b>
					</p>
				</div>
				<div className="flex justify-end pt-24 sm:pt-28">
					<p
						ref={note}
						className="font-hand text-pen relative z-10 -rotate-1 text-[22px] leading-tight sm:text-[24px]"
					>
						stays, as the mountain stays
					</p>
				</div>
				{arrow && (
					<svg
						aria-hidden
						className="pointer-events-none absolute inset-0 size-full overflow-visible"
					>
						<path
							d={arrow.line}
							fill="none"
							stroke="var(--pen)"
							strokeWidth="2.5"
							strokeLinecap="round"
						/>
						<polygon points={arrow.head} fill="var(--pen)" strokeLinejoin="round" />
					</svg>
				)}
			</div>
			<label className="mt-8 flex items-center gap-4 text-[15px]">
				<span className="text-muted-foreground shrink-0">Verse width</span>
				<input
					type="range"
					min={52}
					max={100}
					value={width}
					onChange={(event) => setWidth(Number(event.target.value))}
					className="accent-sky h-11 w-full cursor-pointer"
					aria-describedby="anchor-hint"
				/>
			</label>
			<p id="anchor-hint" className="sr-only">
				Narrowing the verse rewraps the text. The arrow stays attached to the word abideth.
			</p>
		</div>
	)
}
