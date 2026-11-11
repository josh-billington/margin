import { WordAnchorDemo } from '@/components/word-anchor-demo'

export default function AnchorsSection() {
	return (
		<section
			id="anchors"
			aria-labelledby="anchors-title"
			className="bg-chrome scroll-mt-8 py-24 md:py-36"
		>
			<div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-12">
				<div className="md:col-span-5">
					<h2
						id="anchors-title"
						data-reveal
						className="text-ink text-[clamp(32px,3.8vw,52px)] font-semibold leading-[1.05] tracking-[-0.03em] text-balance"
					>
					  Connect ideas to verses
					</h2>
					<p
						data-reveal
						style={{ '--d': '80ms' } as React.CSSProperties}
						className="text-ink/85 mt-6 max-w-[30rem] text-[17px] leading-relaxed"
					>
						In Margin an arrow is bound to the word you drew it to, not to a spot on the screen.
						Resize the verses, change the text size, close the app and come back next year: it still
						points at the same word.
					</p>
					<p
						data-reveal
						style={{ '--d': '140ms' } as React.CSSProperties}
						className="text-muted-foreground mt-4 max-w-[30rem] text-[15px] leading-relaxed"
					>
						Try it. Drag the width and watch the verse rewrap.
					</p>
				</div>
				<div
					data-reveal
					style={{ '--d': '120ms' } as React.CSSProperties}
					className="md:col-span-7"
				>
					<WordAnchorDemo />
				</div>
			</div>
		</section>
	)
}
