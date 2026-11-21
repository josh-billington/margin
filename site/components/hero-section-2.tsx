import { HeroHeader } from '@/components/header'
import { DownloadButton, FollowLink, IntelLink } from '@/components/download-button'
import { HillsShader } from '@/components/hills-shader'

const assistants = [
	{ src: '/logos/claude.webp', name: 'Claude' },
	{ src: '/logos/chatgpt.webp', name: 'ChatGPT' },
	{ src: '/logos/codex.webp', name: 'Codex' },
]

const AppIcon = ({ src, name }: { src: string; name: string }) => (
	// eslint-disable-next-line @next/next/no-img-element -- small static app icons
	<img src={src} alt={name} title={name} width={28} height={28} className="size-7" />
)

const alt =
	'A Margin study called Prayer: verses from across the Bible laid out on a canvas, handwritten notes with arrows pointing at single phrases, tagged words in colour, and the Hebrew behind “walked” open in a lookup.'

export default function HeroSection() {
	return (
		<>
			<HeroHeader />
			{/* One panel behind the header and hero: the page colour at the top, deepening into a blue wash
			    and paper grain towards the bottom, where the window runs off its edge. It tucks up under
			    the header, which keeps its place in the flow. */}
			<section className="hero-stage relative mx-2 -mt-28 overflow-hidden rounded-b-[18px] pt-28 sm:mx-3 sm:rounded-b-[32px]">
				{/* The hills of Moab and the Jordan valley from Edward Lear's Jerusalem from the Mount of
				    Olives (1858–59, public domain), mirrored into one ridge; the join sits behind the window. */}
				<div aria-hidden className="hero-landscape">
					<HillsShader />
				</div>
				<div className="relative mx-auto max-w-6xl px-6 pt-14 text-center md:pt-24">
					<h1
						data-reveal
						className="text-ink mx-auto max-w-[15ch] text-balance text-[clamp(44px,6.6vw,84px)] font-semibold leading-[0.98] tracking-[-0.035em]"
					>
						Make scripture your own
					</h1>
					<p
						data-reveal
						style={{ '--d': '80ms' } as React.CSSProperties}
						className="text-ink/85 mx-auto mt-6 max-w-[34rem] text-pretty text-xl leading-relaxed"
					>
						Map out your study, find connections between verses, notes, and ideas.
					</p>
					<div
						data-reveal
						style={{ '--d': '160ms' } as React.CSSProperties}
						className="mt-9 flex flex-wrap items-center justify-center gap-3"
					>
						<DownloadButton size="lg" />
						<FollowLink />
					</div>
					<IntelLink
						data-reveal
						style={{ '--d': '200ms' } as React.CSSProperties}
						className="mt-4"
					/>
					<p
						data-reveal
						style={{ '--d': '230ms' } as React.CSSProperties}
						className="text-ink/80 mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[15px]"
					>
						Export to Keynote
						<AppIcon src="/logos/keynote.webp" name="Keynote" />
						with
						<span className="flex items-center gap-0.5">
							{assistants.map((app) => (
								<AppIcon key={app.name} {...app} />
							))}
						</span>
					</p>
				</div>
				<div
					data-reveal
					style={{ '--d': '260ms' } as React.CSSProperties}
					className="relative mx-auto mt-14 max-w-5xl px-4 pb-6 sm:px-8 sm:pb-14 md:mt-16 lg:pb-20"
				>
					<picture>
						<source
							media="(prefers-color-scheme: light)"
							srcSet="/shots/window-light-1200.webp 1200w, /shots/window-light-2400.webp 2400w"
							sizes="(min-width: 1200px) 1024px, 100vw"
						/>
						<img
							data-ui
							src="/shots/window-dark-2400.webp"
							srcSet="/shots/window-dark-1200.webp 1200w, /shots/window-dark-2400.webp 2400w"
							sizes="(min-width: 1200px) 1024px, 100vw"
							width={2400}
							height={1239}
							alt={alt}
							fetchPriority="high"
							className="hero-shot relative block h-auto w-full"
						/>
					</picture>
				</div>
			</section>
		</>
	)
}
