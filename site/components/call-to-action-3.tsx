import { DownloadButton, FollowLink } from '@/components/download-button'
import { site } from '@/lib/site'

// Tailark Mist call to action 3, restyled: one closing line, one sentence, the same two actions as the hero.
export default function CallToAction() {
	return (
		<section id="follow" aria-labelledby="follow-title" className="scroll-mt-8 py-28 md:py-44">
			<div className="mx-auto max-w-6xl px-6">
				<div className="grid items-end gap-10 md:grid-cols-12">
					<div className="md:col-span-7">
						<h2
							id="follow-title"
							data-reveal
							className="text-ink text-[clamp(44px,6vw,84px)] font-semibold leading-[0.98] tracking-[-0.035em]"
						>
							Try the beta
						</h2>
						<p
							data-reveal
							style={{ '--d': '80ms' } as React.CSSProperties}
							className="text-ink/85 mt-6 max-w-[32rem] text-xl leading-relaxed"
						>
							{site.downloadUrl
								? 'The beta is free to download. It’s still rough in places, so tell us what you find. Your feedback shapes what comes next.'
								: 'Margin’s first beta isn’t out yet. The Mac download will appear here when it’s ready.'}
						</p>
						<div
							data-reveal
							style={{ '--d': '160ms' } as React.CSSProperties}
							className="mt-9 flex flex-wrap gap-3"
						>
							<DownloadButton size="lg" />
							<FollowLink />
						</div>
						{site.downloadUrl ? (
							<div
								data-reveal
								style={{ '--d': '220ms' } as React.CSSProperties}
								className="text-muted-foreground mt-6 max-w-[34rem] space-y-2 text-[15px] leading-relaxed"
							>
								<p>{site.requirements}</p>
								<p>
									This beta isn’t notarized by Apple yet, so the first time you open it, macOS says it
									can’t verify Margin. Open System Settings › Privacy &amp; Security, click Open Anyway
									next to the message about Margin, then confirm. You only need to do this once.
								</p>
							</div>
						) : null}
					</div>
					<p
						aria-hidden
						data-reveal
						style={{ '--d': '240ms' } as React.CSSProperties}
						className="font-hand text-pen rotate-[-4deg] text-[22px] leading-snug md:text-[24px] md:col-span-4 md:col-start-9 md:pb-4"
					>
						“Thy word is a lamp unto my feet, and a light unto my path.”
						<span className="text-muted-foreground mt-1 block">Psalm 119:105</span>
					</p>
				</div>
			</div>
		</section>
	)
}
