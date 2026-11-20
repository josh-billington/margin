import { useEffect, useState } from 'react'
import { books } from '@shared/bible/books'
import type { BibleSearchRequest, BibleSearchResults } from '@shared/bible/search'
import type { TranslationId } from '@shared/bible/types'

export type SearchState =
	| { kind: 'idle' }
	| { kind: 'loading'; previous?: BibleSearchResults }
	| { kind: 'error'; message: string }
	| { kind: 'ready'; results: BibleSearchResults }

/** "all", "old", "new", or a book id: the scope menu's value. */
export type SearchScope = string

function readScope(value: SearchScope): BibleSearchRequest['scope'] {
	if (value === 'old' || value === 'new') return { kind: 'testament', testament: value }
	const book = books.find(({ id }) => id === value)
	return book ? { kind: 'book', book: book.id } : { kind: 'all' }
}

/**
 * Searches as the reader types, debounced. An explicit translation searches only that edition;
 * otherwise the default applies, with the separate Old Testament default when one is set.
 */
export function useBibleSearch({
	query,
	edition,
	translation,
	oldTestamentTranslation,
	scope,
	delay = 120,
}: {
	query: string
	edition: TranslationId | null
	translation: TranslationId
	oldTestamentTranslation?: TranslationId
	scope: SearchScope
	delay?: number
}): { key: string; state: SearchState } {
	const key = query.trim()
		? [query, edition, translation, oldTestamentTranslation, scope].join('\u0000')
		: ''
	const [settled, setSettled] = useState<{ key: string; state: SearchState }>()
	useEffect(() => {
		if (!key) return
		let current = true
		const request: BibleSearchRequest = {
			query,
			translation: edition
				? { kind: 'edition', id: edition }
				: { kind: 'default', id: translation, oldTestamentId: oldTestamentTranslation },
			scope: readScope(scope),
		}
		const timer = setTimeout(() => {
			window.margin.bible
				.search(request)
				.then((result) => {
					if (!current) return
					setSettled({
						key,
						state: result.ok
							? { kind: 'ready', results: result.data }
							: { kind: 'error', message: result.error.message },
					})
				})
				.catch(() => {
					if (current)
						setSettled({
							key,
							state: { kind: 'error', message: 'Search couldn’t load. Try again.' },
						})
				})
		}, delay)
		return () => {
			current = false
			clearTimeout(timer)
		}
		// The key covers every input.
	}, [key, delay])
	if (!key) return { key, state: { kind: 'idle' } }
	if (settled?.key === key) return { key, state: settled.state }
	// Earlier results stay in place while the next ones load, so the list doesn't jump per keystroke.
	const previous = settled?.state.kind === 'ready' ? settled.state.results : undefined
	return { key, state: { kind: 'loading', previous } }
}
