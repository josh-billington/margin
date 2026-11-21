import * as Dialog from '@radix-ui/react-dialog'
import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import introStyles from './intro.css?inline'
import { introCopy } from './copy'
import { closeIntro, markIntroSeen } from './introStore'
import { PEN, play, prefersReducedMotion, REDUCED_FADE, retarget, SETTLE } from './motion'

type Step = { kind: 'shown' } | { kind: 'leaving'; how: 'finished' | 'skipped' }

/** The dissolve, out of focus and slightly too close; the line arrives from it and leaves into it. */
const BLURRED = { opacity: 0, transform: 'scale(1.05)', filter: 'blur(14px)' }
const CLEAR = { opacity: 1, transform: 'none', filter: 'blur(0px)' }

/**
 * Margin's first-launch welcome: one line on the window's glass that comes into focus, and one button
 * that dissolves it into the app. Its stylesheet is added only while it is mounted.
 */
export function Intro({ restoreFocus }: { restoreFocus: boolean }) {
	const [reduced] = useState(prefersReducedMotion)
	const [step, setStep] = useState<Step>({ kind: 'shown' })
	const content = useRef<HTMLDivElement>(null)
	const backdrop = useRef<HTMLDivElement>(null)
	const chrome = useRef<HTMLDivElement>(null)
	const scene = useRef<HTMLDivElement>(null)
	const title = useRef<HTMLHeadingElement>(null)
	const start = useRef<HTMLButtonElement>(null)
	const shellHold = useRef<Animation | null>(null)

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

	const leave = (how: 'finished' | 'skipped') =>
		setStep((current) => (current.kind === 'leaving' ? current : { kind: 'leaving', how }))

	useLayoutEffect(() => {
		if (step.kind === 'shown') {
			if (reduced) {
				play(title.current, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE })
				play(start.current, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE })
			} else {
				play(title.current, [BLURRED, CLEAR], { duration: 1100, delay: 150 })
				play(start.current, [{ opacity: 0, transform: 'translateY(4px)' }, CLEAR], {
					duration: 600,
					delay: 750,
				})
			}
			start.current?.focus({ preventScroll: true })
			return
		}
		markIntroSeen()
		const skipped = step.how === 'skipped'
		const duration = reduced ? REDUCED_FADE * 1.5 : skipped ? 700 : 1100
		const easing = skipped ? SETTLE : PEN
		// The line dissolves (it fades, grows slightly and blurs) into the app underneath.
		const out = retarget(scene.current, reduced ? { opacity: 0 } : BLURRED, { duration, easing })
		retarget(backdrop.current, { opacity: 0 }, { duration, easing })
		retarget(chrome.current, { opacity: 0 }, { duration: duration / 2, easing })
		const shell = document.querySelector('.app-shell')
		shellHold.current?.cancel()
		shellHold.current = shell?.animate({ opacity: [0, 1] }, { duration, easing, fill: 'none' }) ?? null
		const done = () => closeIntro()
		if (out) out.finished.then(done, done)
		else done()
	}, [step, reduced])

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.repeat) return
		if (event.target instanceof HTMLButtonElement) return
		event.preventDefault()
		leave('finished')
	}
	return (
		// No portal: its content would mount a commit late, after the step effect has run.
		<Dialog.Root open modal>
			<Dialog.Content
				ref={content}
				tabIndex={-1}
				className="intro"
				data-reduced-motion={reduced || undefined}
				aria-describedby={undefined}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => {
					if (!restoreFocus) event.preventDefault()
				}}
				onEscapeKeyDown={(event) => {
					event.preventDefault()
					leave('skipped')
				}}
				onKeyDown={onKeyDown}
			>
				<div ref={backdrop} className="intro-backdrop" />
				<div ref={scene} className="intro-scene">
					<Dialog.Title ref={title} className="intro-title">
						{introCopy.title}
					</Dialog.Title>
					<button
						ref={start}
						type="button"
						className="intro-start"
						onClick={() => leave('finished')}
					>
						{introCopy.start}
					</button>
				</div>
				{/* The title-bar strip stays draggable, as on the window it covers. */}
				<div ref={chrome} className="intro-chrome" />
			</Dialog.Content>
		</Dialog.Root>
	)
}
