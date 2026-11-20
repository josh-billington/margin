import { z } from 'zod'
import { books } from '@margin/contract/bible/books'
import { BIBLE_SEARCH_LIMIT } from '@margin/contract/bible/search'
import type {
	BibleSearchCounts,
	BibleSearchHit,
	BibleSearchPage,
	BibleSearchRequest,
} from '@margin/contract/bible/search'
import { decodeVerseText } from '@margin/contract/bible/storage'
import { verseRefSchema } from '@margin/contract/bible/types'
import type { TranslationId } from '@margin/contract/bible/types'
import type { Database } from '../ports'
import { BOOK_STRIDE, CHAPTER_STRIDE, SEARCH_TABLES } from './searchIndex'
import { findSearchMatches, parseSearchQuery } from './searchText'

const firstNewTestamentBook = books.findIndex(({ testament }) => testament === 'new')
const countRows = z.array(z.object({ ordinal: z.number().int(), total: z.number().int() }))
const hitRows = z.array(verseRefSchema.extend({ rowid: z.number().int(), content: z.string() }))

function searchWindows({ scope, translation }: BibleSearchRequest) {
	const windows: { first: number; end: number; id: TranslationId }[] = []
	const add = (first: number, end: number, id: TranslationId) => {
		if (scope?.kind === 'book') {
			const ordinal = books.findIndex(({ id }) => id === scope.book)
			first = Math.max(first, ordinal)
			end = Math.min(end, ordinal + 1)
		}
		if (scope?.kind === 'testament' && scope.testament === 'old')
			end = Math.min(end, firstNewTestamentBook)
		if (scope?.kind === 'testament' && scope.testament === 'new')
			first = Math.max(first, firstNewTestamentBook)
		if (id === 'jps1917') end = Math.min(end, firstNewTestamentBook)
		if (first < end) windows.push({ first, end, id })
	}
	if (translation.kind === 'edition') add(0, books.length, translation.id)
	else {
		const old = translation.oldTestamentId ?? translation.id
		const next = translation.id === 'jps1917' ? 'kjv' : translation.id
		if (old === next) add(0, books.length, next)
		else {
			add(0, firstNewTestamentBook, old)
			add(firstNewTestamentBook, books.length, next)
		}
	}
	return windows
}

/**
 * One page of hits in canonical order. Rowids encode book, chapter and verse, and the windows
 * cover ascending, disjoint rowid ranges, so the last rowid of a page is a cursor that crosses
 * windows without counting what came before it.
 */
export async function searchBible({
	db,
	request,
}: {
	db: Database
	request: BibleSearchRequest
}): Promise<BibleSearchPage> {
	const terms = parseSearchQuery(request.query)
	const firstPage = request.after === undefined
	if (!terms.length)
		return { hits: [], next: null, counts: firstPage ? { total: 0, books: [] } : null }
	const match = terms.map((term) => `"${term.join(' ')}"`).join(' AND ')
	const windows = searchWindows(request)
	const filter = (table: string) =>
		`FROM ${table} WHERE ${table} MATCH ? AND rowid >= ? AND rowid < ?`
	let counts: BibleSearchCounts | null = null
	if (firstPage) {
		counts = { total: 0, books: [] }
		for (const window of windows) {
			const rows = countRows.parse(
				await db.all(
					`SELECT rowid / ${BOOK_STRIDE} AS ordinal, count(*) AS total ${filter(SEARCH_TABLES[window.id])} GROUP BY ordinal ORDER BY ordinal`,
					[match, window.first * BOOK_STRIDE, window.end * BOOK_STRIDE],
				),
			)
			for (const { ordinal, total } of rows) {
				const book = books[ordinal]?.id
				if (!book) continue
				counts.total += total
				counts.books.push({ book, total })
			}
		}
	}
	// One row past the page says whether another page follows.
	const rows: { rowid: number; hit: BibleSearchHit }[] = []
	for (const { first, end, id } of windows) {
		const from = Math.max(first * BOOK_STRIDE, (request.after ?? -1) + 1)
		const to = end * BOOK_STRIDE
		const wanted = BIBLE_SEARCH_LIMIT + 1 - rows.length
		if (from >= to) continue
		if (wanted <= 0) break
		const found = hitRows.parse(
			await db.all(
				`
			WITH matches AS (
				SELECT rowid ${filter(SEARCH_TABLES[id])} ORDER BY rowid LIMIT ?
			)
			SELECT matches.rowid AS rowid, verses.book, verses.chapter, verses.verse, verses.content
			FROM matches
			CROSS JOIN books ON books.translationId = ? AND books.ordinal = matches.rowid / ${BOOK_STRIDE}
			CROSS JOIN verses ON verses.translationId = books.translationId AND verses.book = books.id
				AND verses.chapter = matches.rowid / ${CHAPTER_STRIDE} % ${CHAPTER_STRIDE}
				AND verses.verse = matches.rowid % ${CHAPTER_STRIDE}
			ORDER BY matches.rowid
		`,
				[match, from, to, wanted, id],
			),
		)
		for (const { rowid, content, ...ref } of found) {
			const text = decodeVerseText(content)
			rows.push({
				rowid,
				hit: { ref, translationId: id, text, matches: findSearchMatches({ text, terms }) },
			})
		}
	}
	const page = rows.slice(0, BIBLE_SEARCH_LIMIT)
	return {
		hits: page.map(({ hit }) => hit),
		next: rows.length > BIBLE_SEARCH_LIMIT ? (page.at(-1)?.rowid ?? null) : null,
		counts,
	}
}
