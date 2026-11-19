import type { Ref } from 'react'
import { HELLO_NIB, HELLO_VIEWBOX, helloLetters } from './hello'
import { play, WRITE } from './motion'
import type { Steps } from './motion'

type Point = readonly [number, number]

/** A smooth path through the pen points (uniform Catmull-Rom as cubic Béziers). */
function penPath(points: ReadonlyArray<Point>) {
	const at = (i: number) => points[Math.min(points.length - 1, Math.max(0, i))] ?? [0, 0]
	let d = `M${at(0)[0]} ${at(0)[1]}`
	for (let i = 0; i < points.length - 1; i++) {
		const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
		const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
		const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
		d += `C${c1.join(' ')} ${c2.join(' ')} ${p2[0]} ${p2[1]}`
	}
	return d
}

const penLength = (points: ReadonlyArray<Point>) =>
	points.reduce((sum, point, i) => {
		const previous = points[i - 1]
		return previous ? sum + Math.hypot(point[0] - previous[0], point[1] - previous[1]) : sum
	}, 0)

const { width, height, top } = HELLO_VIEWBOX

/**
 * "hello" in the handwriting font, written letter by letter: each glyph is revealed through a
 * round nib drawn along the path a pen would take, so it reads as writing, not a wipe.
 */
export function Handwriting({ ref }: { ref: Ref<SVGSVGElement> }) {
	return (
		<svg
			ref={ref}
			className="intro-hello"
			viewBox={`0 ${top} ${width} ${height}`}
			aria-hidden
			focusable="false"
		>
			<defs>
				{helloLetters.map((letter, index) => (
					<mask
						key={index}
						id={`intro-hello-${index}`}
						maskUnits="userSpaceOnUse"
						x={-HELLO_NIB}
						y={top - HELLO_NIB}
						width={width + HELLO_NIB * 2}
						height={height + HELLO_NIB * 2}
					>
						<path
							data-pen=""
							d={penPath(letter.pen)}
							pathLength={1}
							fill="none"
							stroke="#fff"
							strokeWidth={HELLO_NIB}
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeDasharray="1 2"
						/>
					</mask>
				))}
			</defs>
			{helloLetters.map((letter, index) => (
				<path key={index} d={letter.outline} mask={`url(#intro-hello-${index})`} />
			))}
		</svg>
	)
}

/** The word takes this long to write, with a short lift of the pen between letters. */
const WRITING = 1900
const PEN_LIFT = 110

export function writeHello({
	svg,
	steps,
	delay,
}: {
	svg: SVGSVGElement
	steps: Steps
	delay: number
}) {
	const lengths = helloLetters.map((letter) => penLength(letter.pen))
	const total = lengths.reduce((sum, length) => sum + length, 0)
	const writing = WRITING - PEN_LIFT * (lengths.length - 1)
	let start = delay
	svg.querySelectorAll('[data-pen]').forEach((pen, index) => {
		const duration = ((lengths[index] ?? 0) / total) * writing
		steps.add(
			play(pen, [{ strokeDashoffset: 1.001 }, { strokeDashoffset: 0 }], {
				duration,
				delay: start,
				easing: WRITE,
			}),
		)
		start += duration + PEN_LIFT
	})
}
