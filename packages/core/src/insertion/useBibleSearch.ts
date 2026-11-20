import { useEffect, useRef, useState } from 'react'
import { books } from '@shared/bible/books'
import type { BibleSearchCounts, BibleSearchHit, BibleSearchRequest } from '@shared/bible/search'
import type { TranslationId } from '@shared/bible/types'

/** Every page loaded so far for one query, in canonical order. */
export interface SearchList {
	/** The query key these hits belong to. */
	key: string
	hits: readonly BibleSearchHit[]
	counts: BibleSearchCounts
	/** The cursor for the next page; null once every hit is loaded. */
	next: number | null
	/** The state of the page after the last loaded one. */
	more: 'idle' | 'loading' | 'error'
}

export type SearchState =
	| { kind: 'idle' }
	| { kind: 'loading'; previous?: SearchList }
	| { kind: 'error'; message: string }
	| { kind: 'ready'; list: SearchList }

/** "all", "old", "new", or a book id: the scope menu's value. */
export type SearchScope = string

const SEARCH_FAILED = 'Search couldn’t load. Try again.'

function readScope(value: SearchScope): BibleSearchRequest['scope'] {
	if (value === 'old' || value === 'new') return { kind: 'testament', testament: value }
	const book = books.find(({ id }) => id === value)
	return book ? { kind: 'book', book: book.id } : { kind: 'all' }
}

interface Settled {
	key: string
	request: BibleSearchRequest
	state: SearchState
}

/**
 * Searches as the reader types, debounced. An explicit translation searches only that edition;
 * otherwise the default applies, with the separate Old Testament default when one is set.
 * `loadMore` appends the next page at once; one page loads at a time, and a page that returns
 * after the query has changed is dropped.
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
}): { key: string; state: SearchState; loadMore: () => void } {
	const key = query.trim()
		? [query, edition, translation, oldTestamentTranslation, scope].join('\u0000')
		: ''
	const [settled, setSettled] = useState<Settled>()
	// The page request in flight, as key and cursor, so a second call before React re-renders
	// doesn't send it twice.
	const pending = useRef<string | null>(null)
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
						request,
						state: result.ok
							? {
									kind: 'ready',
									list: {
										key,
										hits: result.data.hits,
										counts: result.data.counts ?? { total: result.data.hits.length, books: [] },
										next: result.data.next,
										more: 'idle',
									},
								}
							: { kind: 'error', message: result.error.message },
					})
				})
				.catch(() => {
					if (current)
						setSettled({ key, request, state: { kind: 'error', message: SEARCH_FAILED } })
				})
		}, delay)
		return () => {
			current = false
			clearTimeout(timer)
		}
		// The key covers every input.
	}, [key, delay])

	function loadMore() {
		if (settled?.key !== key || settled.state.kind !== 'ready') return
		const { next, more } = settled.state.list
		const token = `${key}\u0000${next}`
		if (next === null || more === 'loading' || pending.current === token) return
		pending.current = token
		const { request } = settled
		// Only the list this page continues takes it: a new query or an earlier reset drops it.
		const update = (change: (list: SearchList) => SearchList) =>
			setSettled((prev) =>
				prev?.key === key && prev.state.kind === 'ready' && prev.state.list.next === next
					? { ...prev, state: { kind: 'ready', list: change(prev.state.list) } }
					: prev,
			)
		const settle = (change: (list: SearchList) => SearchList) => {
			if (pending.current === token) pending.current = null
			update(change)
		}
		update((list) => ({ ...list, more: 'loading' }))
		window.margin.bible
			.search({ ...request, after: next })
			.then((result) =>
				settle((list) =>
					result.ok
						? {
								...list,
								hits: [...list.hits, ...result.data.hits],
								next: result.data.next,
								more: 'idle',
							}
						: { ...list, more: 'error' },
				),
			)
			.catch(() => settle((list) => ({ ...list, more: 'error' })))
	}

	if (!key) return { key, state: { kind: 'idle' }, loadMore }
	if (settled?.key === key) return { key, state: settled.state, loadMore }
	// Earlier results stay in place while the next ones load, so the list doesn't jump per keystroke.
	const previous = settled?.state.kind === 'ready' ? settled.state.list : undefined
	return { key, state: { kind: 'loading', previous }, loadMore }
}
