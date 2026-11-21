'use client'

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion'

// Tailark Mist FAQs 2, restyled: a sticky heading beside filled tiles.
const faqItems = [
	{
		id: 'release',
		question: 'Can I download Margin now?',
		answer:
			'Yes. Margin is in a free public beta for Macs with Apple silicon (M1 or later) running macOS 13 or later. Expect some rough edges, and tell us when you find one.',
	},
	{
		id: 'verify',
		question: 'Why does macOS say it can’t verify Margin?',
		answer:
			'The beta isn’t notarized by Apple yet. After the warning, open System Settings › Privacy & Security, scroll down and click Open Anyway next to the message about Margin, then confirm. You only need to do this once.',
	},
	{
		id: 'updates',
		question: 'How do I get updates?',
		answer:
			'Choose Margin › Check for Updates… in the menu bar. If a newer beta is out, Margin opens its download page. Margin never checks on its own.',
	},
	{
		id: 'feedback',
		question: 'How do I report a problem or suggest something?',
		answer:
			'Choose Help › Send Feedback… in the app. It opens a new GitHub issue in your browser with your Margin and macOS versions filled in. Nothing from your studies is attached.',
	},
	{
		id: 'price',
		question: 'What will it cost?',
		answer:
			'Margin will always be free to download and use. Later we may charge for syncing across devices and for extra translations and study resources.',
	},
	{
		id: 'translations',
		question: 'Which translations are included?',
		answer:
			'Five public-domain translations come with the app: the King James Version, the Berean Standard Bible, the World English Bible and the American Standard Version for the whole Bible, and the JPS 1917 translation of the Tanakh. Licensed translations such as the ESV aren’t included yet.',
	},
	{
		id: 'offline',
		question: 'Does it need an internet connection?',
		answer:
			'No. Once it’s installed, Margin works offline. It goes online only when you ask it to check for updates or send feedback.',
	},
	{
		id: 'files',
		question: 'Where are my studies kept?',
		answer:
			'In a folder you choose the first time you open Margin. Unless you pick another, it’s Documents › Margin. To change it later, click Library folder… at the bottom of the sidebar. Each study is one plain JSON file, so you can back it up, sync it or move it to another Mac.',
	},
	{
		id: 'other-tools',
		question: 'Can I use my studies in other apps?',
		answer:
			'Yes. Because each study is a plain file, other tools can read it, including AI assistants. That makes it easy to search across your notes or turn a study into slides for a group you teach. The studying itself stays yours: Margin has no AI built in.',
	},
	{
		id: 'platforms',
		question: 'Is there a version for iPad, iPhone or Windows?',
		answer:
			'Not for now. Margin is a Mac app, designed for a large screen, a trackpad and a keyboard.',
	},
	{
		id: 'ink',
		question: 'Can I draw freehand?',
		answer:
			'No. You type your notes, in a handwritten-style font if you like, and draw arrows from them to words. Freehand drawing isn’t included.',
	},
	{
		id: 'tldraw',
		question: 'Why is there a tldraw mark on the canvas?',
		answer:
			'Margin’s canvas is built on the tldraw SDK. Its licence asks for a small “made with tldraw” mark in the corner, and Margin keeps it there.',
	},
]

export default function FAQs() {
	return (
		<section id="faq" aria-labelledby="faq-title" className="bg-chrome scroll-mt-8 py-24 md:py-36">
			<div className="mx-auto max-w-6xl px-6">
				<div className="grid gap-10 md:grid-cols-12 md:gap-12">
					<div className="md:col-span-4">
						<div className="md:sticky md:top-24">
							<h2
								id="faq-title"
								data-reveal
								className="text-ink text-[clamp(32px,3.8vw,52px)] font-semibold leading-[1.05] tracking-[-0.03em] text-balance"
							>
								Questions
							</h2>
							<p
								data-reveal
								style={{ '--d': '80ms' } as React.CSSProperties}
								className="text-ink/80 mt-5 max-w-[22rem] text-[17px] leading-relaxed"
							>
								Not answered here? Choose Help › Send Feedback… in the app, or open an issue on
								GitHub.
							</p>
						</div>
					</div>

					<div className="md:col-span-8">
						<Accordion type="single" collapsible defaultValue="release" className="space-y-2">
							{faqItems.map((item) => (
								<AccordionItem
									key={item.id}
									value={item.id}
									className="bg-night data-[state=open]:bg-surface"
								>
									<AccordionTrigger>{item.question}</AccordionTrigger>
									<AccordionContent>
										<p className="text-ink/85 text-[17px] leading-relaxed">{item.answer}</p>
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</div>
			</div>
		</section>
	)
}
