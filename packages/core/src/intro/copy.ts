import type { VerseRef } from '@shared/bible/types'

/**
 * Every word the welcome intro shows, in one place to edit. The verse is read from the bundled
 * Bible; `highlight`, `arrowFrom` and `arrowTo` name words in it, and `note` is written beside it.
 */
export const introCopy = {
	label: 'Welcome to Margin',
	skip: 'Skip intro',
	next: 'Continue',
	finish: 'Get started',
	pages: [
		{
			title: 'Study with a pen in hand.',
			body: 'Margin is a canvas for the verses you’re studying.',
		},
		{
			title: 'Mark what you see.',
			body: 'Highlight and tag words to trace a theme through a chapter.',
		},
		{
			title: 'Connect the verses.',
			body: 'Draw an arrow from one word to another, across any passage.',
		},
		{
			title: 'Keep your thoughts beside the text.',
			body: 'Notes stay with the verses they’re about.',
		},
	],
	welcome: ['Welcome', 'to', 'Margin'],
	verse: {
		ref: { book: 'ROM', chapter: 12, verse: 2 } satisfies VerseRef,
		translation: 'kjv',
		/** Tagged on page 2, with the tag's name shown as Margin shows it. */
		highlight: 'transformed',
		tag: { name: 'Renewal', color: 'amber' },
		arrowFrom: 'conformed',
		arrowTo: 'transformed',
		note: 'Changed from within — metamorphoō',
	},
} as const

export type PageIndex = 0 | 1 | 2 | 3
export const LAST_PAGE: PageIndex = 3
