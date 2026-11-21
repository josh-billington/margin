import { cn } from '@/lib/utils'

// Tailark Mist features 5, restyled and extended into Margin's capability rows: a two-line
// statement beside a real crop of the app, with the crops varying in size and placement.

function Shot({
	src,
	width,
	height,
	alt,
	className,
}: {
	src: string
	width: number
	height: number
	alt: string
	className?: string
}) {
	return (
		<picture>
			<source media="(prefers-color-scheme: light)" srcSet={src.replace('.webp', '-light.webp')} />
			<img
				data-ui
				src={src}
				width={width}
				height={height}
				alt={alt}
				loading="lazy"
				decoding="async"
				className={cn('bg-night ring-border block h-auto w-full rounded-[12px] ring-1', className)}
			/>
		</picture>
	)
}

function Statement({
	title,
	children,
	kbd,
}: {
	title: string
	children: React.ReactNode
	kbd?: string
}) {
	return (
		<div>
			<h3
				data-reveal
				className="text-ink text-[clamp(28px,3vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em] text-balance"
			>
				{title}
			</h3>
			<p
				data-reveal
				style={{ '--d': '80ms' } as React.CSSProperties}
				className="text-ink/85 mt-5 max-w-[30rem] text-[17px] leading-relaxed"
			>
				{children}
			</p>
			{kbd && (
				<p
					data-reveal
					style={{ '--d': '140ms' } as React.CSSProperties}
					className="font-hand text-pen mt-6 -rotate-1 text-[24px]"
				>
					{kbd}
				</p>
			)}
		</div>
	)
}

export default function Features() {
	return (
		<section id="features" aria-label="Features" className="scroll-mt-8 py-28 md:py-44">
			<div className="mx-auto w-full max-w-6xl space-y-32 px-6 md:space-y-48">
				<div className="grid items-center gap-12 md:grid-cols-12">
					<div className="md:col-span-5">
						<Statement title="Add verses from the keyboard" kbd="⌘K, then Psalm 23">
							Press ⌘K and type a reference, such as John 3:16 or Amos 1:3–5. Add one verse or a
							whole chapter.
						</Statement>
					</div>
					<div className="relative md:col-span-7">
						<div data-reveal>
							<Shot
								src="/shots/palette.webp"
								width={1052}
								height={765}
								alt="The command palette, with the prompt “Type a reference or a command” and Add verses highlighted."
								className="rounded-[18px] ring-0 md:w-[86%]"
							/>
						</div>
						<div
							data-reveal
							style={{ '--d': '120ms' } as React.CSSProperties}
							className="relative -mt-16 ml-auto w-[78%] md:-mt-24 md:w-[66%]"
						>
							<Shot
								src="/shots/add-verses.webp"
								width={1052}
								height={421}
								className="rounded-[18px] ring-0"
								alt="The Add verses dialog with Psalm 23 typed in, previewing Psalms 23:1–6, and a choice of five translations."
							/>
						</div>
					</div>
				</div>

				<div className="grid items-center gap-12 md:grid-cols-12">
					<div className="grid grid-cols-[0.42fr_1fr] items-start gap-3 md:order-first md:col-span-7 md:gap-4">
						<div data-reveal>
							<Shot
								src="/shots/sidebar.webp"
								width={560}
								height={827}
								alt="The sidebar listing the tags Trust, Zion and Steadfast, each with its colour and a count of its highlights."
							/>
						</div>
						<div
							data-reveal
							style={{ '--d': '100ms' } as React.CSSProperties}
							className="mt-12 md:mt-20"
						>
							<Shot
								src="/shots/annotations.webp"
								width={1400}
								height={843}
								alt="Psalm 125:1 with trust tagged in blue, mount Zion in amber and the closing words in violet, and three handwritten notes connected to single words by arrows."
							/>
						</div>
					</div>
					<div className="md:col-span-5 md:pl-6">
						<Statement title="Tag your favourite verses and important words">
							Tag words and phrases in a colour and see every tag in the sidebar. Choose one to mark
							each place it appears and step through them in order.
						</Statement>
					</div>
				</div>

				<div className="grid items-center gap-12 md:grid-cols-12">
					<div className="md:col-span-5">
						<Statement title="Look up the Hebrew and Greek" kbd="right-click, or ⌃⌘D">
							In the King James Version, see the Hebrew or Greek word behind the English, with its
							Strong’s entry. Add what you find as a note on the word.
						</Statement>
					</div>
					<div className="md:col-span-7">
						<div data-reveal>
							<Shot
								src="/shots/lookup.webp"
								width={740}
								height={630}
								alt="The word lookup for trust in Psalm 125:1: the Hebrew בָּטַח (bâṭach), Strong’s number H982, its meaning and its KJV renderings."
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
