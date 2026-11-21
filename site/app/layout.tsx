import type { Metadata, Viewport } from 'next'
import { Reveal } from '@/components/reveal'
import { site } from '@/lib/site'
import './globals.css'

export const metadata: Metadata = {
	metadataBase: new URL(site.url),
	title: {
		default: 'make scripture your own',
		template: '%s margin',
	},
	description: site.description,
	applicationName: 'margin',
	openGraph: {
		type: 'website',
		siteName: 'margin',
		title: 'make scripture your own',
		description: site.description,
		url: '/',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'make scripture your own',
		description: site.description,
	},
}

export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#f7f4f0' },
		{ media: '(prefers-color-scheme: dark)', color: '#141115' },
	],
	colorScheme: 'dark light',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* Opt into entrance motion only when script runs; without it everything stays visible. */}
				<script
					dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
				/>
			</head>
			<body className="min-h-dvh">
				<a
					href="#main"
					className="bg-sky text-primary-foreground sr-only z-50 rounded-full px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
				>
					Skip to content
				</a>
				{children}
				<Reveal />
			</body>
		</html>
	)
}
