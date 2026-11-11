import Link from 'next/link'
import { LogoIcon } from '@/components/logo'
import { site } from '@/lib/site'

// A quiet closing row of links and credits.
const links = [
	{ title: 'Privacy', href: '/privacy/' },
	...(site.githubUrl ? [{ title: 'GitHub', href: site.githubUrl }] : []),
	{ title: 'Questions', href: '/#faq' },
]

export default function Footer() {
	return (
		<footer className="bg-chrome py-8">
			<div className="mx-auto max-w-6xl px-6">
				<div className="flex flex-wrap items-center justify-between gap-x-12 gap-y-6">
					<div className="flex items-center gap-3">
						<Link
							href="/"
							aria-label="Margin home"
							className="pressable -ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg"
						>
							<LogoIcon />
						</Link>
						<span className="text-muted-foreground text-[15px]">
							© {new Date().getFullYear()} Margin
						</span>
					</div>
					<nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 text-[15px]">
						{links.map((link) => (
							<Link
								key={link.title}
								href={link.href}
								className="text-ink/75 hover:text-ink transition-colors duration-150"
							>
								{link.title}
							</Link>
						))}
						<a
							href="https://tldraw.dev"
							className="text-ink/75 hover:text-ink transition-colors duration-150"
						>
							built with tldraw
						</a>
					</nav>
				</div>
			</div>
		</footer>
	)
}
