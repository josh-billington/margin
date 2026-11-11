const principles = [
	{
		title: 'Works offline',
		body: 'Scripture, fonts and everything else ship inside the app. Margin never needs the network to open a study.',
	},
	{
		title: 'Your studies are files',
		body: 'Each study is a plain JSON file in a Margin folder in your Documents. Back it up, sync it, or open it with the other tools you already use.',
	},
	{
		title: 'No account',
		body: 'There is nothing to sign up for, and nothing reports back. No analytics, no tracking.',
	},
	{
		title: 'Made for the keyboard',
		body: 'V, T, A and H switch tools. F focuses. ⌃⌘D looks up a word. ⌘K finds verses and commands.',
	},
	{
		title: 'Handwritten, or plain',
		body: 'Notes are written in a marker-style hand by default, with a plain font for longer thoughts.',
	},
	{
		title: 'Saves as you go',
		body: 'Every change is saved. If a save fails, or another program changes the file, Margin keeps your work and tells you.',
	},
]

export default function Principles() {
	return (
		<section aria-labelledby="principles-title" className="py-28 md:py-40">
			<div className="mx-auto max-w-6xl px-6">
				<h2
					id="principles-title"
					data-reveal
					className="text-ink max-w-[18ch] text-[clamp(32px,3.8vw,52px)] font-semibold leading-[1.05] tracking-[-0.03em] text-balance"
				>
					Built for focused study
				</h2>
				<dl className="mt-16 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
					{principles.map((item, i) => (
						<div
							key={item.title}
							data-reveal
							style={{ '--d': `${(i % 3) * 70}ms` } as React.CSSProperties}
						>
							<dt className="text-ink text-xl font-semibold">{item.title}</dt>
							<dd className="text-ink/80 mt-3 text-[17px] leading-relaxed">{item.body}</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	)
}
