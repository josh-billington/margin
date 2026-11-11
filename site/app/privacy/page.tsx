import type { Metadata } from 'next'
import { HeroHeader } from '@/components/header'
import Footer from '@/components/footer-4'
import { site } from '@/lib/site'

export const metadata: Metadata = {
	title: 'Privacy',
	description:
		'Margin works offline, has no account and collects nothing. Your studies stay on your Mac as plain files.',
	alternates: { canonical: '/privacy/' },
}

const sections: { title: string; body: React.ReactNode }[] = [
	{
		title: 'The app collects nothing',
		body: 'Margin has no account, no sign-in, no analytics, no crash reporting and no advertising. It doesn’t send your studies, your notes, or anything about how you use it anywhere.',
	},
	{
		title: 'It works offline',
		body: 'The Bible text, fonts and everything else the app needs are installed with it. Margin doesn’t need the network to open, edit or save a study.',
	},
	{
		title: 'Your studies stay on your Mac',
		body: 'Each study is saved as a plain JSON file in a Margin folder in your Documents, or in another folder you choose. Margin also keeps a little local state, such as which study was open last, in its own app folder. If you sync or back up those folders with another service, that service’s own privacy terms apply.',
	},
	{
		title: 'This website',
		body: 'This site is a set of static pages. It sets no cookies and runs no analytics or tracking scripts, and it loads no fonts or scripts from other companies. The host that serves the pages may keep ordinary server logs, such as IP addresses and request times, as every web server does.',
	},
	{
		title: 'Changes',
		body: 'If any of this changes, for example if a future version adds an optional feature that uses the network, this page will say so before that version is released. Last updated 3 November 2026.',
	},
]

export default function PrivacyPage() {
	return (
		<>
			<HeroHeader />
			<main id="main" className="pb-32 pt-16 md:pt-28">
				<article className="mx-auto max-w-3xl px-6">
					<h1 className="text-ink text-[clamp(40px,5.4vw,72px)] font-semibold leading-[1] tracking-[-0.035em]">
						Privacy
					</h1>
					<p className="text-ink/85 mt-7 max-w-[36rem] text-xl leading-relaxed">
						Margin is an offline app with no account. It collects nothing, and your studies never
						leave your Mac unless you move them.
					</p>
					<p className="font-hand text-pen mt-6 -rotate-1 text-[24px]">
						the short version: nothing to see here
					</p>
					<div className="mt-16 space-y-12">
						{sections.map((section) => (
							<section key={section.title}>
								<h2 className="text-ink text-2xl font-semibold tracking-[-0.015em]">
									{section.title}
								</h2>
								<p className="text-ink/85 mt-3 text-[17px] leading-relaxed">{section.body}</p>
							</section>
						))}
						<section>
							<h2 className="text-ink text-2xl font-semibold tracking-[-0.015em]">Questions</h2>
							<p className="text-ink/85 mt-3 text-[17px] leading-relaxed">
								{site.contactEmail ? (
									<>
										Write to{' '}
										<a
											className="text-sky underline-offset-4 hover:underline"
											href={`mailto:${site.contactEmail}`}
										>
											{site.contactEmail}
										</a>
										.
									</>
								) : (
									'A contact address will be listed here before the first release.'
								)}
							</p>
						</section>
					</div>
				</article>
			</main>
			<Footer />
		</>
	)
}
