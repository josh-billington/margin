import { useEffect, useRef } from 'react'
import type { InkPoint, InkStroke } from '@shared/study/types'
import type { PassageText, Token } from '@shared/bible/types'
import { shownLeading } from '@shared/bible/tokenizer'
import { blockTitle } from '../insertion/labels'
import { verseKey } from '../canvas/highlights/ranges'
import { HEAD_LENGTH } from '../canvas/bindings/terminals'
import { arrowHead } from '../canvas/ink/InkShapeUtil'
import { INK_SIZE, strokePath } from '../canvas/ink/stroke'
import { introCopy } from './copy'
import { drive, easeInOutSine, play, PEN, REDUCED_FADE } from './motion'
import type { Steps } from './motion'

const tokenText = (token: Token) => token.runs.map((run) => run.text).join('')
const { verse: copy } = introCopy

/** The parts of the verse page each step animates. */
type Parts = {
	block: HTMLElement
	highlight: HTMLElement | null
	from: HTMLElement | null
	to: HTMLElement | null
	ink: SVGPathElement
	head: SVGPolygonElement
	note: HTMLElement
}

/** Layout position inside the stage, unaffected by the transforms the stage animates with. */
function layoutRect(element: HTMLElement, stage: HTMLElement) {
	let x = 0,
		y = 0
	for (
		let node: Element | null = element;
		node instanceof HTMLElement && node !== stage;
		node = node.offsetParent
	) {
		x += node.offsetLeft
		y += node.offsetTop
	}
	return { x, y, w: element.offsetWidth, h: element.offsetHeight }
}

/**
 * The stroke a hand would draw from the end of one word, out into the margin, and back to the end
 * of the other, with the pressure rising and easing off as a real pen stroke does.
 */
function connectingStroke({ from, to }: { from: DOMRectLike; to: DOMRectLike }): InkStroke {
	const start = { x: from.x + from.w + 6, y: from.y + from.h * 0.58 }
	const end = { x: to.x + to.w + 8, y: to.y + to.h * 0.5 }
	// A loose hand: the stroke swings out a little further than it comes back.
	const reach = Math.max(start.x, end.x)
	const out = { a: reach + 58, b: reach + 44 }
	const point = (t: number): InkPoint => {
		const u = 1 - t
		const x = u ** 3 * start.x + 3 * u * u * t * out.a + 3 * u * t * t * out.b + t ** 3 * end.x
		const y =
			u ** 3 * start.y +
			3 * u * u * t * (start.y - 4) +
			3 * u * t * t * (end.y + 2) +
			t ** 3 * end.y
		return { x, y, z: 0.42 + 0.18 * Math.sin(Math.PI * t) }
	}
	const rest = Array.from({ length: 40 }, (_, i) => point((i + 1) / 40))
	return [point(0), ...rest]
}
type DOMRectLike = { x: number; y: number; w: number; h: number }

/** The stroke drawn so far: whole points up to `progress`, then a partial step to the pen tip. */
function strokeUpTo(points: InkStroke, progress: number): InkStroke {
	const [first, ...rest] = points
	const reach = progress * rest.length
	const whole = rest.slice(0, Math.floor(reach))
	const from = whole.at(-1) ?? first
	const next = rest[Math.floor(reach)]
	const part = reach % 1
	const tip =
		next && part > 0
			? {
					x: from.x + (next.x - from.x) * part,
					y: from.y + (next.y - from.y) * part,
					z: from.z + (next.z - from.z) * part,
				}
			: null
	return [first, ...whole, ...(tip ? [tip] : [])]
}

/**
 * One verse from the bundled Bible in Margin's own passage styling, gaining a highlight, an ink
 * arrow and a handwritten note as the pages advance (`stage` 1, 2, 3). Earlier stages that have not
 * played (a fast reader, or a slow verse load) appear finished.
 */
export function VerseStudy({
	passage,
	stage,
	steps,
	reduced,
}: {
	passage: PassageText
	stage: number
	steps: Steps
	reduced: boolean
}) {
	const root = useRef<HTMLDivElement>(null)
	const played = useRef(0)
	// A passive effect, so it runs after the intro's own step effect has finished the last stage.
	// Everything it reveals starts hidden, so the frame before it runs shows nothing new.
	useEffect(() => {
		const stageElement = root.current
		if (!stageElement || stage <= played.current) return
		const find = (word: string) =>
			stageElement.querySelector<HTMLElement>(`[data-intro-word="${word}"]`)
		const block = stageElement.querySelector<HTMLElement>('.passage-block')
		const ink = stageElement.querySelector<SVGPathElement>('.intro-ink path')
		const head = stageElement.querySelector<SVGPolygonElement>('.intro-ink polygon')
		const note = stageElement.querySelector<HTMLElement>('.margin-note')
		if (!block || !ink || !head || !note) return
		const parts: Parts = {
			block,
			highlight: find(copy.highlight),
			from: find(copy.arrowFrom),
			to: find(copy.arrowTo),
			ink,
			head,
			note,
		}
		for (let next = played.current + 1; next <= stage; next++)
			reveal({ parts, stage: next, current: next === stage, stageElement, steps, reduced })
		played.current = stage
	}, [stage, steps, reduced])
	const verses = passage.verses
	return (
		<div ref={root} className="intro-study" aria-hidden>
			<div className="passage-block">
				<header className="passage-header">
					<span>{blockTitle(passage.ranges, passage.edition.translationId)}</span>
				</header>
				<div className="passage-text">
					{verses.map((verse) => (
						<span key={verseKey(verse.ref)} className="scripture-verse">
							<sup className="verse-number">{verse.ref.verse}</sup>
							{verse.tokens.map((token, index) => (
								<span key={token.i}>
									<span className="word" data-intro-word={tokenText(token).toLowerCase()}>
										{shownLeading(token, index === 0)}
										{token.runs.map((run, i) => (
											<span key={i} style={{ fontStyle: run.italic ? 'italic' : 'normal' }}>
												{run.text}
											</span>
										))}
										{token.trailing}
									</span>
									{token.spaceAfter}
								</span>
							))}
						</span>
					))}
				</div>
			</div>
			<svg className="intro-ink">
				<g fill="var(--pen)">
					<path />
					<polygon />
				</g>
			</svg>
			<div className="margin-note">
				{copy.note.split(' ').map((word, index) => (
					<span key={index}>
						<span className="intro-note-word">{word}</span>{' '}
					</span>
				))}
			</div>
		</div>
	)
}

function reveal({
	parts,
	stage,
	current,
	stageElement,
	steps,
	reduced,
}: {
	parts: Parts
	stage: number
	current: boolean
	stageElement: HTMLElement
	steps: Steps
	reduced: boolean
}) {
	// A stage that is being caught up on appears finished; only the current one plays.
	const settle = (animation: Animation | null) => {
		steps.add(animation)
		if (!current) animation?.finish()
	}
	const fade = (target: Element | null, delay = 0) =>
		settle(play(target, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE, delay }))
	switch (stage) {
		case 1: {
			// The verse arrives on the canvas, then one word is marked in a tag colour.
			if (reduced) {
				fade(parts.block)
				settle(
					play(parts.highlight, [{ fontWeight: 600, color: 'var(--amber)' }], {
						duration: 0,
					}),
				)
				return
			}
			settle(play(parts.block, [{ opacity: 1 }], { duration: 0 }))
			settle(
				play(
					parts.block.querySelector('.passage-header'),
					[
						{ opacity: 0, transform: 'translateY(6px)' },
						{ opacity: 1, transform: 'none' },
					],
					{ duration: 700, delay: 320 },
				),
			)
			settle(
				play(
					parts.block.querySelector('.passage-text'),
					[
						{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(3px)' },
						{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
					],
					{ duration: 800, delay: 400 },
				),
			)
			// The highlight is the one place the intro animates more than transform and opacity: Margin
			// marks a word by its weight and colour, so the word gains both, as it would on the canvas.
			settle(
				play(
					parts.highlight,
					[
						{ fontWeight: 400, color: 'var(--text-scripture)' },
						{ fontWeight: 600, color: 'var(--amber)' },
					],
					{ duration: 700, delay: 1050, easing: PEN },
				),
			)
			return
		}
		case 2: {
			if (!parts.from || !parts.to) return
			const points = connectingStroke({
				from: layoutRect(parts.from, stageElement),
				to: layoutRect(parts.to, stageElement),
			})
			const head = arrowHead({ points, length: HEAD_LENGTH })
				.map(({ x, y }) => `${x},${y}`)
				.join(' ')
			parts.head.setAttribute('points', head)
			const tip = points.at(-1) ?? points[0]
			parts.head.style.transformOrigin = `${tip.x}px ${tip.y}px`
			const draw = (progress: number) =>
				parts.ink.setAttribute(
					'd',
					strokePath({ points: strokeUpTo(points, progress), size: INK_SIZE }),
				)
			if (reduced) {
				draw(1)
				fade(parts.ink)
				fade(parts.head)
				return
			}
			// The pen draws the line at a hand's pace; the head lands as the stroke finishes.
			const line = drive({ duration: 1050, delay: 380, ease: easeInOutSine, draw })
			steps.add(line)
			if (!current) line.finish()
			settle(
				play(
					parts.head,
					[
						{ opacity: 0, transform: 'scale(0.6)' },
						{ opacity: 1, transform: 'none' },
					],
					{ duration: 260, delay: 1380 },
				),
			)
			return
		}
		case 3: {
			if (reduced) {
				fade(parts.note)
				return
			}
			settle(play(parts.note, [{ opacity: 0 }, { opacity: 1 }], { duration: 0 }))
			parts.note.querySelectorAll('.intro-note-word').forEach((word, index) =>
				settle(
					play(
						word,
						[
							{ opacity: 0, transform: 'translateY(3px)', filter: 'blur(3px)' },
							{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
						],
						{ duration: 620, delay: 300 + index * 110 },
					),
				),
			)
			return
		}
	}
}
