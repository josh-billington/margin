import { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import { books } from '@shared/bible/books'
import { BIBLE_SEARCH_LIMIT } from '@shared/bible/search'
import { STORAGE_VERSION } from '@shared/bible/storage'
import type { BibleSearchRequest } from '@shared/bible/search'
import type { BookId, TranslationId } from '@shared/bible/types'
import {
	BOOK_STRIDE,
	CHAPTER_STRIDE,
	SEARCH_TABLES,
	createSearchTable,
} from '@margin/services/bible/searchIndex'
import {
	findSearchMatches,
	normalizeSearchText,
	parseSearchQuery,
} from '@margin/services/bible/searchText'
import { searchBible } from '@margin/services/bible/search'
import type { Database } from '@margin/services/ports'

describe('Bible search text', () => {
	it('normalizes case, internal apostrophes, accents and punctuation', () => {
		expect(normalizeSearchText("“LORD’S” — mercy, KĪNG'S!")).toBe('lords mercy kīngs')
		expect(normalizeSearchText('Pai\u0302n')).toBe('paîn')
		expect(parseSearchQuery('LORD’S “tender mercy” OR (grace*)')).toEqual([
			['lords'],
			['tender', 'mercy'],
			['or'],
			['grace'],
		])
		expect(parseSearchQuery('loving-kindness mercy')).toEqual([['loving', 'kindness'], ['mercy']])
		expect(parseSearchQuery('! " " —')).toEqual([])
	})
	it('highlights every exact phrase occurrence without highlighting stray words', () => {
		const text = 'Tender—mercy; mercy. tender mercy.'
		const matches = findSearchMatches({ text, terms: parseSearchQuery('"tender mercy"') })
		expect(matches).toEqual([
			[0, 6],
			[7, 12],
			[21, 33],
		])
	})
})

describe('Bible search over SQLite', () => {
	const sqlite = new DatabaseSync(':memory:')
	sqlite.exec(`
		CREATE TABLE books (translationId TEXT, id TEXT, ordinal INTEGER, PRIMARY KEY(translationId, id));
		CREATE TABLE verses (translationId TEXT, book TEXT, chapter INTEGER, verse INTEGER, content TEXT,
			PRIMARY KEY(translationId, book, chapter, verse)) WITHOUT ROWID;
	`)
	for (const id of ['kjv', 'jps1917', 'web'] satisfies TranslationId[])
		sqlite.exec(createSearchTable(id))
	function seed({
		id,
		book,
		verse,
		text,
	}: {
		id: TranslationId
		book: BookId
		verse: number
		text: string
	}) {
		const ordinal = books.findIndex(({ id }) => id === book)
		sqlite.prepare('INSERT OR IGNORE INTO books VALUES (?, ?, ?)').run(id, book, ordinal)
		sqlite
			.prepare('INSERT INTO verses VALUES (?, ?, 1, ?, ?)')
			.run(id, book, verse, JSON.stringify([[text, 0]]))
		sqlite
			.prepare(`INSERT INTO ${SEARCH_TABLES[id]} (rowid, text) VALUES (?, ?)`)
			.run(ordinal * BOOK_STRIDE + CHAPTER_STRIDE + verse, normalizeSearchText(text))
	}
	seed({ id: 'kjv', book: 'MAT', verse: 1, text: 'Mercy is welcome here.' })
	seed({ id: 'kjv', book: 'GEN', verse: 2, text: 'Mercy is the Lord’s.' })
	seed({ id: 'kjv', book: 'GEN', verse: 1, text: "The LORD'S mercy endures." })
	seed({ id: 'jps1917', book: 'GEN', verse: 1, text: 'Mercy is kind.' })
	seed({ id: 'web', book: 'MAT', verse: 1, text: 'Mercy is good.' })
	for (let verse = 1; verse <= BIBLE_SEARCH_LIMIT + 3; verse++)
		seed({ id: 'kjv', book: 'EXO', verse, text: 'The people.' })
	for (let verse = 1; verse <= BIBLE_SEARCH_LIMIT + 1; verse++)
		seed({ id: 'jps1917', book: 'LEV', verse, text: 'The law.' })
	for (let verse = 1; verse <= 5; verse++)
		seed({ id: 'web', book: 'JHN', verse, text: 'The word.' })
	seed({ id: 'kjv', book: 'JHN', verse: 1, text: 'The light.' })
	const db: Database = {
		all: async (sql, bindings = []) => {
			const params = bindings.map((value) => {
				if (typeof value === 'number' || typeof value === 'string') return value
				throw new Error('Unexpected test binding')
			})
			return sqlite.prepare(sql).all(...params)
		},
		get: async () => undefined,
		userVersion: async () => STORAGE_VERSION,
		close: async () => sqlite.close(),
	}
	afterAll(() => db.close())
	const search = (
		query: string,
		filters: Partial<Pick<BibleSearchRequest, 'scope' | 'translation' | 'after'>> = {},
	) =>
		searchBible({
			db,
			request: {
				query,
				translation: { kind: 'edition', id: 'kjv' },
				scope: { kind: 'all' },
				...filters,
			},
		})
	/** Follows the cursor to the end, as the dialog does while the reader scrolls. */
	async function allPages(
		query: string,
		filters: Partial<Pick<BibleSearchRequest, 'scope' | 'translation'>> = {},
	) {
		const pages = [await search(query, filters)]
		for (let next = pages[0]?.next; next != null; next = pages.at(-1)?.next)
			pages.push(await search(query, { ...filters, after: next }))
		return pages
	}
	const ids = (pages: { hits: { translationId: TranslationId; ref: { book: BookId } }[] }[]) =>
		pages.map(({ hits }) => [...new Set(hits.map((hit) => `${hit.translationId}:${hit.ref.book}`))])
	const position = ({ ref }: { ref: { book: BookId; chapter: number; verse: number } }) =>
		books.findIndex(({ id }) => id === ref.book) * BOOK_STRIDE +
		ref.chapter * CHAPTER_STRIDE +
		ref.verse

	it('matches all words in any order but requires phrase adjacency and order', async () => {
		expect((await search('mercy LORD’S')).hits.map(({ ref }) => ref.verse)).toEqual([1, 2])
		expect((await search('"Lord’s mercy"')).hits.map(({ ref }) => ref.verse)).toEqual([1])
		expect((await search('"mercy lord\'s"')).counts?.total).toBe(0)
		expect((await search('mercy OR missing')).counts?.total).toBe(0)
		expect(await search('!')).toEqual({ hits: [], next: null, counts: { total: 0, books: [] } })
		expect(await search('!', { after: 5 })).toEqual({ hits: [], next: null, counts: null })
	})
	it('applies scoped editions and separate Old Testament defaults', async () => {
		const translation = {
			kind: 'default',
			id: 'web',
			oldTestamentId: 'jps1917',
		} satisfies BibleSearchRequest['translation']
		const results = await search('mercy', { translation })
		expect(results.hits.map(({ translationId }) => translationId)).toEqual(['jps1917', 'web'])
		expect(
			(await search('mercy', { translation, scope: { kind: 'testament', testament: 'new' } }))
				.counts?.total,
		).toBe(1)
		expect((await search('mercy', { scope: { kind: 'book', book: 'GEN' } })).counts?.total).toBe(2)
		expect(
			(
				await search('mercy', {
					translation: { kind: 'edition', id: 'jps1917' },
					scope: { kind: 'book', book: 'MAT' },
				})
			).counts?.total,
		).toBe(0)
	})
	it('pages in canonical order, counting only with the first page', async () => {
		const pages = await allPages('the')
		expect(pages.map(({ hits }) => hits.length)).toEqual([BIBLE_SEARCH_LIMIT, 6])
		expect(pages[0]?.counts).toEqual({
			total: BIBLE_SEARCH_LIMIT + 6,
			books: [
				{ book: 'GEN', total: 2 },
				{ book: 'EXO', total: BIBLE_SEARCH_LIMIT + 3 },
				{ book: 'JHN', total: 1 },
			],
		})
		expect(pages[1]?.counts).toBeNull()
		expect(pages[1]?.next).toBeNull()
		const order = pages.flatMap(({ hits }) => hits.map(position))
		expect(order).toEqual([...new Set(order)].sort((left, right) => left - right))
		// The cursor of the last hit, or any cursor past the end, finds nothing more.
		const last = pages[1]?.hits.at(-1)
		expect(await search('the', { after: last ? position(last) : 0 })).toEqual({
			hits: [],
			next: null,
			counts: null,
		})
		expect((await search('the', { after: 66 * BOOK_STRIDE })).hits).toEqual([])
	})
	it('crosses from an Old Testament translation into the New Testament one', async () => {
		const pages = await allPages('the', {
			translation: { kind: 'default', id: 'web', oldTestamentId: 'kjv' },
		})
		expect(pages[0]?.counts?.total).toBe(BIBLE_SEARCH_LIMIT + 10)
		expect(pages.map(({ hits }) => hits.length)).toEqual([BIBLE_SEARCH_LIMIT, 10])
		expect(ids(pages)).toEqual([
			['kjv:GEN', 'kjv:EXO'],
			['kjv:EXO', 'web:JHN'],
		])
	})
	it('pages JPS 1917, which has no New Testament', async () => {
		const edition = await allPages('the', { translation: { kind: 'edition', id: 'jps1917' } })
		expect(edition.map(({ hits }) => hits.length)).toEqual([BIBLE_SEARCH_LIMIT, 1])
		expect(edition[0]?.counts?.total).toBe(BIBLE_SEARCH_LIMIT + 1)
		// As the default, the New Testament falls back to the KJV.
		const fallback = await allPages('the', { translation: { kind: 'default', id: 'jps1917' } })
		expect(fallback.map(({ hits }) => hits.length)).toEqual([BIBLE_SEARCH_LIMIT, 2])
		expect(ids(fallback)).toEqual([['jps1917:LEV'], ['jps1917:LEV', 'kjv:JHN']])
	})
	it('pages within a testament or a book', async () => {
		const old = await allPages('the', { scope: { kind: 'testament', testament: 'old' } })
		expect(old.map(({ hits }) => hits.length)).toEqual([BIBLE_SEARCH_LIMIT, 5])
		const book = await allPages('the', { scope: { kind: 'book', book: 'EXO' } })
		expect(book.map(({ hits }) => hits.length)).toEqual([BIBLE_SEARCH_LIMIT, 3])
		expect(book[0]?.counts).toEqual({
			total: BIBLE_SEARCH_LIMIT + 3,
			books: [{ book: 'EXO', total: BIBLE_SEARCH_LIMIT + 3 }],
		})
		expect(book.flatMap(({ hits }) => hits.map(({ ref }) => ref.verse))).toEqual(
			Array.from({ length: BIBLE_SEARCH_LIMIT + 3 }, (_, index) => index + 1),
		)
	})
	it('ends without a cursor when the last page is exactly full', async () => {
		// EXO 1:4 to 1:203 is exactly one page.
		const after = position({ ref: { book: 'EXO', chapter: 1, verse: 3 } })
		const page = await search('people', { after })
		expect(page.hits.length).toBe(BIBLE_SEARCH_LIMIT)
		expect(page.hits[0]?.ref.verse).toBe(4)
		expect(page.next).toBeNull()
	})
})
