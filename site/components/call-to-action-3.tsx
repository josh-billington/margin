import { DownloadButton, FollowLink, IntelLink } from '@/components/download-button'

// Closing call to action: one line and the same two actions as the hero.
export default function CallToAction() {
	return (
		<section id="follow" aria-labelledby="follow-title" className="scroll-mt-8 py-28 md:py-44">
			<div className="mx-auto max-w-6xl px-6">
				<h2
					id="follow-title"
					data-reveal
					className="text-ink text-[clamp(44px,6vw,84px)] font-semibold leading-[0.98] tracking-[-0.035em]"
				>
					Get it on macOS
				</h2>
				<div
					data-reveal
					style={{ '--d': '160ms' } as React.CSSProperties}
					className="mt-9 flex flex-wrap gap-3"
				>
					<DownloadButton size="lg" />
					<FollowLink />
				</div>
				<IntelLink data-reveal style={{ '--d': '200ms' } as React.CSSProperties} className="mt-5" />
			</div>
		</section>
	)
}
