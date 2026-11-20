import { z } from 'zod'
import { books } from '@margin/contract/bible/books'
import { BIBLE_SEARCH_LIMIT } from '@margin/contract/bible/search'
import type { BibleSearchRequest, BibleSearchResults } from '@margin/contract/bible/search'
import { decodeVerseText } from '@margin/contract/bible/storage'
import { verseRefSchema } from '@margin/contract/bible/types'
import type { BookId, TranslationId } from '@margin/contract/bible/types'
import type { Database } from '../ports'
import { BOOK_STRIDE, CHAPTER_STRIDE, SEARCH_TABLES } from './searchIndex'
import { findSearchMatches, parseSearchQuery } from './searchText'

const firstNewTestamentBook = books.findIndex(({ testament }) => testament === 'new')
const countRows = z.array(z.object({ ordinal: z.number().int(), total: z.number().int() }))
const hitRows = z.array(verseRefSchema.extend({ content: z.string() }))

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

export async function searchBible({
	db,
	request,
}: {
	db: Database
	request: BibleSearchRequest
}): Promise<BibleSearchResults> {
	const terms = parseSearchQuery(request.query)
	const groups = new Map<BookId, BibleSearchResults['groups'][number]>()
	if (!terms.length) return { total: 0, groups: [] }
	const match = terms.map((term) => `"${term.join(' ')}"`).join(' AND ')
	let total = 0
	let remaining = BIBLE_SEARCH_LIMIT
	for (const { first, end, id } of searchWindows(request)) {
		const table = SEARCH_TABLES[id]
		const filter = `FROM ${table} WHERE ${table} MATCH ? AND rowid >= ? AND rowid < ?`
		const bindings = [match, first * BOOK_STRIDE, end * BOOK_STRIDE]
		const counts = countRows.parse(
			await db.all(
				`SELECT rowid / ${BOOK_STRIDE} AS ordinal, count(*) AS total ${filter} GROUP BY ordinal`,
				bindings,
			),
		)
		const byBook = new Map(counts.map(({ ordinal, total }) => [books[ordinal]?.id, total]))
		total += counts.reduce((sum, row) => sum + row.total, 0)
		if (remaining === 0 || counts.length === 0) continue
		const hits = hitRows.parse(
			await db.all(
				`
			WITH matches AS (
				SELECT rowid ${filter} ORDER BY rowid LIMIT ?
			)
			SELECT verses.book, verses.chapter, verses.verse, verses.content
			FROM matches
			CROSS JOIN books ON books.translationId = ? AND books.ordinal = matches.rowid / ${BOOK_STRIDE}
			CROSS JOIN verses ON verses.translationId = books.translationId AND verses.book = books.id
				AND verses.chapter = matches.rowid / ${CHAPTER_STRIDE} % ${CHAPTER_STRIDE}
				AND verses.verse = matches.rowid % ${CHAPTER_STRIDE}
			ORDER BY matches.rowid
		`,
				[...bindings, remaining, id],
			),
		)
		for (const { content, ...ref } of hits) {
			let group = groups.get(ref.book)
			if (!group) {
				group = { book: ref.book, total: byBook.get(ref.book) ?? 0, hits: [] }
				groups.set(ref.book, group)
			}
			const text = decodeVerseText(content)
			group.hits.push({ ref, translationId: id, text, matches: findSearchMatches({ text, terms }) })
		}
		remaining -= hits.length
	}
	return { total, groups: [...groups.values()] }
}
