import { books } from '@shared/bible/books'
import type { VerseRef } from '@shared/bible/types'

export interface OrderablePassage {
	id: string
	first?: VerseRef
	x: number
	y: number
}
const bookOrder = new Map<string, number>(books.map((book, i) => [book.id, i]))
const rank = (ref?: VerseRef) => [
	bookOrder.get(ref?.book ?? '') ?? 1e6,
	ref?.chapter ?? 0,
	ref?.verse ?? 0,
]

/** Scripture order (canonical book, chapter, verse); ties fall back to reading position on the canvas. */
export function orderPassages<T extends OrderablePassage>(passages: readonly T[]): T[] {
	return [...passages].sort((a, b) => {
		const ra = rank(a.first),
			rb = rank(b.first)
		for (let i = 0; i < 3; i++) if (ra[i] !== rb[i]) return (ra[i] ?? 0) - (rb[i] ?? 0)
		return a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)
	})
}
