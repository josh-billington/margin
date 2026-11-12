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
			'Yes. Margin is in a free public beta for Macs with Apple silicon (M1 or later) running macOS 12 or later. Expect some rough edges, and please tell us when you find one.',
	},
	{
		id: 'verify',
		question: 'Why does macOS say it can’t verify Margin?',
		answer:
			'The beta isn’t notarized by Apple yet. After the warning, open System Settings, go to Privacy & Security, scroll down and click Open Anyway next to Margin, then confirm. You only need to do this once.',
	},
	{
		id: 'updates',
		question: 'How do I get updates?',
		answer:
			'Choose Margin › Check for Updates… from the menu bar. If a newer beta is out, Margin takes you to the download. Margin never checks on its own, so it stays offline until you ask.',
	},
	{
		id: 'feedback',
		question: 'How do I report a problem or suggest something?',
		answer:
			'Choose Help › Send Feedback… in the app. It opens a new GitHub issue with your Margin and macOS versions filled in. Your studies are never attached.',
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
			'The King James Version, the Berean Standard Bible, the World English Bible and the American Standard Version for the whole Bible, and the JPS 1917 translation of the Tanakh. All are public domain and come with the app. Licensed translations such as the ESV aren’t part of the first version.',
	},
	{
		id: 'offline',
		question: 'Does it need an internet connection?',
		answer:
			'No. Once it’s installed, Margin works entirely offline. The text, fonts and app live on your Mac.',
	},
	{
		id: 'files',
		question: 'Where are my studies kept?',
		answer:
			'In a folder you choose the first time you open Margin, Documents › Margin unless you pick another. Each study is one plain JSON file, so you can back them up, sync them with any service you already use, or move them to another Mac.',
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
			'The first version has typed notes in a handwritten style, drawn arrows and tagged highlights. Freehand ink isn’t included.',
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
								If your question isn’t here, ask it on GitHub. Choose Help › Send Feedback… in the
								app, or open an issue on the project page.
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
