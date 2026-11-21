import { HeroHeader } from '@/components/header'
import { HeroFrames } from '@/components/hero-frames'
import { DownloadButton, FollowLink } from '@/components/download-button'

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
								  Make scripture your own
								</h1>
								<p
									data-reveal
									style={{ '--d': '80ms' } as React.CSSProperties}
									className="text-ink/85 mt-7 max-w-[34rem] text-xl leading-relaxed"
								>
								  Map out your study, find connections between verses, notes, and ideas
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
