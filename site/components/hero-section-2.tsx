import { HeroHeader } from '@/components/header'
import { HeroFrames } from '@/components/hero-frames'
import { DownloadButton, FollowLink } from '@/components/download-button'

// Tailark Mist hero section 2, restyled: left-aligned, one headline, one sentence, one action,
// the product shot below on a Chrome stage. A handwritten note sits in the hero's margin.
export default function HeroSection() {
	return (
		<>
			<HeroHeader />
			<section className="relative overflow-hidden">
				<div className="pt-12 md:pt-20">
					<div className="relative z-10 mx-auto max-w-6xl px-6">
						<div className="grid items-end gap-10 lg:grid-cols-12">
							<div className="lg:col-span-8">
								<h1
									data-reveal
									className="text-ink max-w-[15ch] text-[clamp(44px,6.6vw,92px)] font-semibold leading-[0.98] tracking-[-0.035em]"
								>
									Make it your own
								</h1>
								<p
									data-reveal
									style={{ '--d': '80ms' } as React.CSSProperties}
									className="text-ink/85 mt-7 max-w-[34rem] text-xl leading-relaxed"
								>
									Map out your study, find connections between verses, notes, and ideas.
								</p>
								<div
									data-reveal
									style={{ '--d': '160ms' } as React.CSSProperties}
									className="mt-9 flex flex-wrap items-center gap-3"
								>
									<DownloadButton size="lg" />
									<FollowLink />
								</div>
							</div>
							<div
								aria-hidden
								data-reveal
								style={{ '--d': '320ms' } as React.CSSProperties}
								className="relative hidden h-40 lg:col-span-4 lg:block"
							>
								<p className="font-hand text-pen absolute right-6 top-2 -rotate-3 text-[24px] leading-tight">
									your notes stay
									<br />
									on the word
								</p>
								<svg
									className="absolute bottom-[-56px] right-36 h-36 w-28"
									viewBox="0 0 112 144"
									fill="none"
								>
									<path
										d="M98 6C60 18 26 50 22 128"
										stroke="var(--pen)"
										strokeWidth="2.6"
										strokeLinecap="round"
									/>
									<path d="M22 140 12 117l21 3z" fill="var(--pen)" />
								</svg>
							</div>
						</div>
					</div>
					<div className="relative mt-12 md:mt-14">
						<div aria-hidden className="bg-chrome absolute inset-x-0 bottom-0 top-1/3" />
						<div
							data-reveal
							style={{ '--d': '240ms' } as React.CSSProperties}
							className="relative mx-auto max-w-6xl px-3 pb-10 sm:px-6 md:pb-16"
						>
							<HeroFrames />
						</div>
					</div>
				</div>
			</section>
		</>
	)
}
