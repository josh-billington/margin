import { bookIdSchema } from '@shared/bible/types'
import { formatScriptureCopy } from './copy'
import type { CopiedWord } from './copy'

/** Collects the selected words in `root` in scripture order; null when no scripture is selected. */
export function copySelectedScripture(
	root: HTMLElement | null,
	editionName: string,
): string | null {
	const selection = window.getSelection()
	if (!root || !selection || selection.isCollapsed) return null
	const words: CopiedWord[] = []
	for (const element of root.querySelectorAll<HTMLElement>('[data-word]')) {
		if (!selection.containsNode(element, true)) continue
		const book = bookIdSchema.safeParse(element.dataset.book)
		if (!book.success) continue
		words.push({
			text: element.textContent ?? '',
			spaceAfter: element.nextSibling?.textContent ?? '',
			verse: {
				book: book.data,
				chapter: Number(element.dataset.chapter),
				verse: Number(element.dataset.verseNumber),
			},
		})
	}
	return words.length ? formatScriptureCopy(words, editionName) : null
}
