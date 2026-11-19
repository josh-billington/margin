import type { Ref } from 'react'
import paper from './icon-paper.svg?raw'
import night from './icon-night.svg?raw'
import type { ResolvedAppearance } from '@shared/ipc/contract'
import { play, PEN, REDUCED_FADE, SETTLE, WRITE } from './motion'
import type { Steps } from './motion'

/**
 * Margin's mark: the ivory tile in light appearance, the night tile in dark. The SVGs are copies of
 * the app icon artwork with each layer (tile, rim, cover, pages, lines, sheen, ribbon) wrapped in a
 * `data-layer` group so it can form on its own.
 */
export function Mark({
	appearance,
	ref,
}: {
	appearance: ResolvedAppearance
	ref: Ref<HTMLDivElement>
}) {
	return (
		<div
			ref={ref}
			className="intro-mark"
			aria-hidden
			dangerouslySetInnerHTML={{ __html: appearance === 'light' ? paper : night }}
		/>
	)
}

/** How long the mark takes to form, so the first page can follow it. */
export const MARK_FORMED = 2900

/**
 * The mark forms like glass: the tile condenses out of a blur, its rim catches the light, the cover
 * and then the pages settle onto it, the lines are written in reading order, and the ribbon drops in.
 */
export function formMark({
	mark,
	steps,
	reduced,
}: {
	mark: HTMLElement
	steps: Steps
	reduced: boolean
}) {
	if (reduced) {
		steps.add(play(mark, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE * 2 }))
		return
	}
	const layer = (name: string) => mark.querySelectorAll(`[data-layer="${name}"]`)
	const each = (
		name: string,
		keyframes: Keyframe[],
		timing: { duration: number; delay: number; easing?: string },
	) => {
		for (const element of layer(name)) steps.add(play(element, keyframes, timing))
	}
	steps.add(
		play(
			mark,
			[
				{ opacity: 0, transform: 'scale(0.9)', filter: 'blur(12px)' },
				{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
			],
			{ duration: 1300 },
		),
	)
	each('tile', [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 0 })
	each('rim', [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 350 })
	each(
		'cover',
		[
			{ opacity: 0, transform: 'translateY(2px)' },
			{ opacity: 1, transform: 'none' },
		],
		{ duration: 800, delay: 550 },
	)
	const settle = [
		{ opacity: 0, transform: 'translateY(-2.5px) scale(0.97)' },
		{ opacity: 1, transform: 'none' },
	]
	each('page-left', settle, { duration: 900, delay: 720 })
	each('page-right', settle, { duration: 900, delay: 820 })
	each('spine', [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 1050 })
	// The lines are written column by column, top to bottom, as the page would be read.
	mark.querySelectorAll('[data-line]').forEach((line, index) => {
		steps.add(
			play(line, [{ strokeDashoffset: 1.001 }, { strokeDashoffset: 0 }], {
				duration: 280,
				delay: 1200 + index * 45,
				easing: WRITE,
			}),
		)
	})
	each('sheen', [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 1750 })
	each(
		'ribbon',
		[
			{ opacity: 0, transform: 'translateY(-6px) scaleY(0.75)' },
			{ opacity: 1, transform: 'none' },
		],
		{ duration: 750, delay: 2100, easing: SETTLE },
	)
}

/** The finished mark returns for the ending: no rebuild, it simply comes back into focus. */
export function returnMark({
	mark,
	steps,
	reduced,
	delay,
}: {
	mark: HTMLElement
	steps: Steps
	reduced: boolean
	delay: number
}) {
	for (const element of mark.querySelectorAll('[data-layer], [data-line]'))
		for (const animation of element.getAnimations()) animation.finish()
	for (const animation of mark.getAnimations()) animation.cancel()
	steps.add(
		play(
			mark,
			reduced
				? [{ opacity: 0 }, { opacity: 1 }]
				: [
						{ opacity: 0, transform: 'scale(0.96)', filter: 'blur(6px)' },
						{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
					],
			{ duration: reduced ? REDUCED_FADE : 800, delay, easing: reduced ? SETTLE : PEN },
		),
	)
}
