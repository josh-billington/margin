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
		question: 'When can I download Margin?',
		answer:
			'Not quite yet. Margin is still being built, and the download will appear on this page when the first version is ready. Until then the button says so.',
	},
	{
		id: 'price',
		question: 'What will it cost?',
		answer:
			'Margin will always be free to download and use, we are looking at pricing for covering data syncing across devices and additional translations and study resources.',
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
			'In a Margin folder in your Documents, one plain JSON file per study. You can back them up, sync them with any service you already use, or move them to another Mac.',
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
								We're working hard on building the best app for studying the Bible. We've tried our
								best to address any questions you might have, for more questions contact us.
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
