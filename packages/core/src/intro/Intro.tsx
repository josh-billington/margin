import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { PassageText } from '@shared/bible/types'
import introStyles from './intro.css?inline'
import { useAppearance } from '../app/glass'
import { introCopy, LAST_PAGE } from './copy'
import type { PageIndex } from './copy'
import { closeIntro, markIntroSeen } from './introStore'
import { formMark, Mark, MARK_FORMED, returnMark } from './Mark'
import { Handwriting, writeHello } from './Handwriting'
import { VerseStudy } from './VerseStudy'
import { PEN, play, prefersReducedMotion, REDUCED_FADE, retarget, SETTLE, Steps } from './motion'

type Step =
	| { kind: 'opening' }
	| { kind: 'page'; index: PageIndex }
	| { kind: 'ending' }
	| { kind: 'leaving'; how: 'finished' | 'skipped' }

const nextPage = (index: PageIndex): PageIndex | null =>
	index === 0 ? 1 : index === 1 ? 2 : index === 2 ? 3 : null

/** Pause on the formed mark before the first page, and on the welcome before the dissolve. */
const OPENING_HOLD = 350
const WELCOME_HOLD = 1400

/**
 * Margin's first-launch welcome. The mark forms on the window's glass, four user-paced pages build
 * one verse into a small study (handwriting, a highlight, an ink arrow, a note), and the ending
 * dissolves into the app. Its stylesheet is added only while it is mounted.
 */
export function Intro({ restoreFocus }: { restoreFocus: boolean }) {
	const appearance = useAppearance()
	const [reduced] = useState(prefersReducedMotion)
	const [step, setStep] = useState<Step>({ kind: 'opening' })
	const [passage, setPassage] = useState<PassageText | null>(null)
	const [steps] = useState(() => new Steps())
	const content = useRef<HTMLDivElement>(null)
	const backdrop = useRef<HTMLDivElement>(null)
	const chrome = useRef<HTMLDivElement>(null)
	const scene = useRef<HTMLDivElement>(null)
	const mark = useRef<HTMLDivElement>(null)
	const pages = useRef<HTMLDivElement>(null)
	const sheet = useRef<HTMLDivElement>(null)
	const hello = useRef<SVGSVGElement>(null)
	const text = useRef<HTMLDivElement>(null)
	const footer = useRef<HTMLDivElement>(null)
	const next = useRef<HTMLButtonElement>(null)
	const welcome = useRef<HTMLParagraphElement>(null)
	const shellHold = useRef<Animation | null>(null)
	const pending = useRef<{ timer: number; commit: () => void } | null>(null)

	// Styles live only as long as the intro: the app's stylesheet is untouched before and after.
	useLayoutEffect(() => {
		const style = document.createElement('style')
		style.textContent = introStyles
		document.head.append(style)
		return () => style.remove()
	}, [])

	// The app stays hidden underneath, so on a glass window the intro sits on the glass itself.
	useLayoutEffect(() => {
		const shell = document.querySelector('.app-shell')
		shellHold.current =
			shell?.animate({ opacity: [0, 0] }, { duration: Number.POSITIVE_INFINITY }) ?? null
		return () => {
			shellHold.current?.cancel()
			shellHold.current = null
		}
	}, [])

	useEffect(() => {
		let live = true
		const { ref, translation } = introCopy.verse
		window.margin.bible
			.getPassage({ translationId: translation, ranges: [{ start: ref, end: ref }] })
			.then((result) => {
				if (live && result.ok) setPassage(result.data)
			})
			.catch(() => {})
		return () => {
			live = false
		}
	}, [])

	useEffect(
		() => () => {
			steps.cancel()
			if (pending.current) window.clearTimeout(pending.current.timer)
		},
		[steps],
	)

	const commitPending = () => {
		const current = pending.current
		if (!current) return false
		window.clearTimeout(current.timer)
		pending.current = null
		current.commit()
		return true
	}
	/** Plays the way out of the current page, then moves on; pressing again moves on at once. */
	const leaveThen = (target: Step, out: () => number) => {
		const wait = out()
		pending.current = {
			timer: window.setTimeout(() => commitPending(), wait),
			commit: () => setStep(target),
		}
	}

	const advance = () => {
		if (commitPending()) return
		switch (step.kind) {
			case 'opening':
				return setStep({ kind: 'page', index: 0 })
			case 'page': {
				const index = nextPage(step.index)
				if (index === null)
					return leaveThen({ kind: 'ending' }, () => {
						retarget(
							pages.current,
							reduced
								? { opacity: 0 }
								: { opacity: 0, transform: 'translateY(-8px) scale(0.985)', filter: 'blur(2px)' },
							{ duration: reduced ? REDUCED_FADE : 520 },
						)
						return reduced ? REDUCED_FADE : 300
					})
				return leaveThen({ kind: 'page', index }, () => {
					retarget(
						text.current,
						reduced ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-6px)' },
						{ duration: reduced ? REDUCED_FADE / 2 : 240 },
					)
					return reduced ? REDUCED_FADE / 2 : 200
				})
			}
		}
	}
	const skip = () => {
		if (step.kind === 'leaving') return
		if (pending.current) window.clearTimeout(pending.current.timer)
		pending.current = null
		setStep({ kind: 'leaving', how: 'skipped' })
	}

	useLayoutEffect(() => {
		const timers: number[] = []
		const after = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))
		const focusNext = () => {
			const active = document.activeElement
			if (!active || active === document.body || active === content.current)
				next.current?.focus({ preventScroll: true })
		}
		// Leaving dissolves from whatever is on screen; every other step first completes the last.
		if (step.kind !== 'leaving') steps.finish()
		switch (step.kind) {
			case 'opening': {
				if (mark.current) formMark({ mark: mark.current, steps, reduced })
				after((reduced ? REDUCED_FADE * 2 : MARK_FORMED) + OPENING_HOLD, () =>
					setStep({ kind: 'page', index: 0 }),
				)
				break
			}
			case 'page': {
				enterPage({ index: step.index })
				focusNext()
				break
			}
			case 'ending': {
				// Continue is gone for the ending; keep focus inside the dialog.
				const active = document.activeElement
				if (!active || active === document.body || active === next.current)
					content.current?.focus({ preventScroll: true })
				if (mark.current)
					returnMark({ mark: mark.current, steps, reduced, delay: reduced ? 0 : 300 })
				welcome.current?.querySelectorAll('.intro-welcome-word').forEach((word, index) =>
					steps.add(
						reduced
							? play(word, [{ opacity: 0 }, { opacity: 1 }], {
									duration: REDUCED_FADE,
									delay: 200 + index * 120,
								})
							: play(
									word,
									[
										{
											opacity: 0,
											transform: 'perspective(500px) rotateX(72deg) translateY(6px)',
											filter: 'blur(4px)',
										},
										{
											opacity: 1,
											transform: 'perspective(500px) rotateX(0deg) translateY(0px)',
											filter: 'blur(0px)',
										},
									],
									{ duration: 800, delay: 800 + index * 170 },
								),
					),
				)
				after((reduced ? 600 : 1900) + WELCOME_HOLD, () =>
					setStep({ kind: 'leaving', how: 'finished' }),
				)
				break
			}
			case 'leaving': {
				markIntroSeen()
				const skipped = step.how === 'skipped'
				const duration = reduced ? REDUCED_FADE * 1.5 : skipped ? 700 : 1100
				const easing = skipped ? SETTLE : PEN
				// The mark dissolves (it fades, grows slightly and blurs) into the app underneath.
				const out = retarget(
					scene.current,
					reduced ? { opacity: 0 } : { opacity: 0, transform: 'scale(1.05)', filter: 'blur(14px)' },
					{ duration, easing },
				)
				retarget(backdrop.current, { opacity: 0 }, { duration, easing })
				retarget(chrome.current, { opacity: 0 }, { duration: duration / 2, easing })
				const shell = document.querySelector('.app-shell')
				shellHold.current?.cancel()
				shellHold.current =
					shell?.animate({ opacity: [0, 1] }, { duration, easing, fill: 'none' }) ?? null
				const done = () => closeIntro()
				if (out) out.finished.then(done, done)
				else done()
				break
			}
		}
		return () => timers.forEach((timer) => window.clearTimeout(timer))
	}, [step, steps, reduced])

	function enterPage({ index }: { index: PageIndex }) {
		const arrive = (
			target: Element | null,
			delay: number,
			from: Keyframe = { opacity: 0, transform: 'translateY(8px)' },
		) =>
			steps.add(
				reduced
					? play(target, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE, delay: 0 })
					: play(target, [from, { opacity: 1, transform: 'none' }], { duration: 640, delay }),
			)
		const title = text.current?.querySelector('h2') ?? null
		const body = text.current?.querySelector('p') ?? null
		if (text.current) for (const animation of text.current.getAnimations()) animation.cancel()
		if (index === 0) {
			// The mark rises away as the canvas arrives and the first word is written on it.
			retarget(
				mark.current,
				reduced
					? { opacity: 0 }
					: { opacity: 0, transform: 'translateY(-12px) scale(0.96)', filter: 'blur(4px)' },
				{ duration: reduced ? REDUCED_FADE : 520 },
			)
			steps.add(play(pages.current, [{ opacity: 1 }], { duration: 0 }))
			arrive(title, 260)
			arrive(body, 340)
			arrive(footer.current, 460, { opacity: 0, transform: 'translateY(4px)' })
			if (hello.current)
				if (reduced) arrive(hello.current, 0)
				else writeHello({ svg: hello.current, steps, delay: 420 })
			return
		}
		if (index === 1) {
			// The handwriting lifts off the glass, then the verse card forms where it was: the one
			// arrival the pages build towards.
			steps.add(
				retarget(
					hello.current,
					reduced ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.98)', filter: 'blur(6px)' },
					{ duration: reduced ? REDUCED_FADE : 380 },
				),
			)
			steps.add(
				reduced
					? play(sheet.current, [{ opacity: 0 }, { opacity: 1 }], {
							duration: REDUCED_FADE,
							delay: REDUCED_FADE / 2,
						})
					: play(
							sheet.current,
							[
								{ opacity: 0, transform: 'translateY(14px) scale(0.96)', filter: 'blur(10px)' },
								{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
							],
							{ duration: 950, delay: 260 },
						),
			)
		}
		arrive(title, 40)
		arrive(body, 120)
	}

	const pageIndex: PageIndex =
		step.kind === 'page' ? step.index : step.kind === 'opening' ? 0 : LAST_PAGE
	const page = introCopy.pages[pageIndex]
	const announcement =
		step.kind === 'page'
			? `${page.title} ${page.body}`
			: step.kind === 'ending'
				? introCopy.label
				: ''
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
		// Holding Return moves one page, not one per key repeat.
		if (event.repeat) return event.preventDefault()
		if (event.target instanceof HTMLButtonElement) return
		event.preventDefault()
		advance()
	}
	return (
		// No portal: its content would mount a commit late, after the step effects have run.
		<Dialog.Root open modal>
			<Dialog.Content
				ref={content}
				tabIndex={-1}
				className="intro"
				data-reduced-motion={reduced || undefined}
				aria-describedby="intro-announcement"
				onOpenAutoFocus={(event) => {
					event.preventDefault()
					content.current?.focus({ preventScroll: true })
				}}
				onCloseAutoFocus={(event) => {
					if (!restoreFocus) event.preventDefault()
				}}
				onEscapeKeyDown={(event) => {
					event.preventDefault()
					skip()
				}}
				onKeyDown={onKeyDown}
			>
				<div ref={backdrop} className="intro-backdrop" />
				<Dialog.Title className="intro-visually-hidden">{introCopy.label}</Dialog.Title>
				<p id="intro-announcement" className="intro-visually-hidden" aria-live="polite">
					{announcement}
				</p>
				<div ref={scene} className="intro-scene">
					<div className="intro-hero">
						<Mark ref={mark} appearance={appearance} />
						<p ref={welcome} className="intro-welcome" aria-hidden>
							{introCopy.welcome.map((word) => (
								<span key={word} className="intro-welcome-word">
									{word}
								</span>
							))}
						</p>
					</div>
					<div ref={pages} className="intro-pages">
						{/* The card keeps its place while hidden, so nothing below it moves between pages;
						    on the first page "hello" is written straight onto the glass in that space. */}
						<div className="intro-stage" aria-hidden>
							<div ref={sheet} className="intro-sheet">
								{passage && (
									<VerseStudy
										passage={passage}
										stage={step.kind === 'page' ? step.index : pageIndex}
										steps={steps}
										reduced={reduced}
									/>
								)}
							</div>
							<Handwriting ref={hello} />
						</div>
						<div ref={text} className="intro-text" aria-hidden>
							<h2>{page.title}</h2>
							<p>{page.body}</p>
						</div>
						<div ref={footer} className="intro-footer">
							<div className="intro-dots" aria-hidden>
								{introCopy.pages.map((_, index) => (
									<span key={index} data-current={index === pageIndex || undefined} />
								))}
							</div>
							<button
								ref={next}
								type="button"
								className="intro-next"
								data-prominent={pageIndex === LAST_PAGE || undefined}
								disabled={step.kind !== 'page'}
								onClick={advance}
							>
								{pageIndex === LAST_PAGE ? introCopy.finish : introCopy.next}
							</button>
							<button type="button" className="intro-skip" onClick={skip}>
								{introCopy.skip}
							</button>
						</div>
					</div>
				</div>
				{/* The title-bar strip stays draggable, as on the window it covers. */}
				<div ref={chrome} className="intro-chrome" />
			</Dialog.Content>
		</Dialog.Root>
	)
}
