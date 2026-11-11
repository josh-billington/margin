'use client'
import React from 'react'
import { Pause, Play } from 'lucide-react'

const frames = [
	{
		name: 'study',
		label: 'The study',
		alt: 'Margin showing Psalm 125:1 on the canvas. The words trust, mount Zion and abideth for ever are tagged in colour, and three handwritten notes point at single words with drawn arrows.',
	},
	{
		name: 'focus-verse',
		label: 'One verse in focus',
		alt: 'Margin in verse focus: Psalm 125:1 stays bright while Psalm 23 below it fades, with its handwritten notes still attached.',
	},
	{
		name: 'overview',
		label: 'The whole canvas',
		alt: 'Margin zoomed out to show the whole study: Psalm 125:1 with its notes, and Psalm 23 below it.',
	},
]

const HOLD = 5600

/** The hero screenshot, slowly crossfading through three states of the same study. */
export function HeroFrames() {
	const [active, setActive] = React.useState(0)
	const [paused, setPaused] = React.useState(false)
	React.useEffect(() => {
		if (paused) return
		const motion = window.matchMedia(
			'(prefers-reduced-motion: no-preference) and (min-width: 640px)',
		)
		let timer: number | undefined
		const start = () => {
			stop()
			if (!motion.matches || document.hidden) return
			timer = window.setInterval(() => setActive((i) => (i + 1) % frames.length), HOLD)
		}
		const stop = () => timer && window.clearInterval(timer)
		const onVisibility = () => (document.hidden ? stop() : start())
		start()
		document.addEventListener('visibilitychange', onVisibility)
		motion.addEventListener('change', onVisibility)
		return () => {
			stop()
			document.removeEventListener('visibilitychange', onVisibility)
			motion.removeEventListener('change', onVisibility)
		}
	}, [paused])
	return (
		<>
			<picture className="sm:hidden">
				<source media="(prefers-color-scheme: light)" srcSet="/shots/hero-mobile-light.webp" />
				<img
					data-ui
					src="/shots/hero-mobile.webp"
					width={1000}
					height={602}
					alt={frames[0].alt}
					fetchPriority="high"
					className="bg-night ring-border block h-auto w-full rounded-[14px] ring-1"
				/>
			</picture>
			<div
				data-ui
				className="bg-night relative hidden aspect-[2620/1800] overflow-hidden rounded-[14px] ring-border ring-1 [container-type:inline-size] sm:block"
			>
				{/* The capture records web content only, so draw the macOS window buttons the app reserves space for. */}
				<span aria-hidden className="traffic-lights">
					<span />
					<span />
					<span />
				</span>
				{frames.map((frame, i) => (
					<picture key={frame.name}>
						<source
							media="(prefers-color-scheme: light)"
							srcSet={`/shots/hero-${frame.name}-light-1200.webp 1200w, /shots/hero-${frame.name}-light-2400.webp 2400w`}
							sizes="(min-width: 1200px) 1152px, 100vw"
						/>
						<img
							src={`/shots/hero-${frame.name}-2400.webp`}
							srcSet={`/shots/hero-${frame.name}-1200.webp 1200w, /shots/hero-${frame.name}-2400.webp 2400w`}
							sizes="(min-width: 1200px) 1152px, 100vw"
							width={2400}
							height={1649}
							alt={i === active ? frame.alt : ''}
							aria-hidden={i === active ? undefined : true}
							loading={i === 0 ? 'eager' : 'lazy'}
							fetchPriority={i === 0 ? 'high' : 'low'}
							decoding="async"
							className="hero-frame absolute inset-0 size-full object-cover object-left-top"
							style={{ opacity: i === active ? 1 : 0 }}
						/>
					</picture>
				))}
			</div>
			<div className="text-muted-foreground mt-2 hidden items-center justify-between gap-4 text-[13px] sm:flex">
				<span>{frames[active].label}</span>
				<button
					type="button"
					onClick={() => setPaused((value) => !value)}
					className="pressable hover:text-ink flex min-h-11 items-center gap-2 rounded-full px-3 motion-reduce:hidden"
					aria-label={paused ? 'Play screenshot slideshow' : 'Pause screenshot slideshow'}
				>
					{paused ? <Play aria-hidden size={14} /> : <Pause aria-hidden size={14} />}
					{paused ? 'Play' : 'Pause'}
				</button>
			</div>
		</>
	)
}
