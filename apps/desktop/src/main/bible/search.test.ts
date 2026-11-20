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
		filters: Partial<Pick<BibleSearchRequest, 'scope' | 'translation'>> = {},
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

	it('matches all words in any order but requires phrase adjacency and order', async () => {
		expect((await search('mercy LORD’S')).groups[0]?.hits.map(({ ref }) => ref.verse)).toEqual([
			1, 2,
		])
		expect((await search('"Lord’s mercy"')).groups[0]?.hits.map(({ ref }) => ref.verse)).toEqual([
			1,
		])
		expect((await search('"mercy lord\'s"')).total).toBe(0)
		expect((await search('mercy OR missing')).total).toBe(0)
		expect((await search('!')).total).toBe(0)
	})
	it('applies scoped editions and separate Old Testament defaults', async () => {
		const translation = {
			kind: 'default',
			id: 'web',
			oldTestamentId: 'jps1917',
		} satisfies BibleSearchRequest['translation']
		const results = await search('mercy', { translation })
		expect(
			results.groups.flatMap(({ hits }) => hits.map(({ translationId }) => translationId)),
		).toEqual(['jps1917', 'web'])
		expect(
			(await search('mercy', { translation, scope: { kind: 'testament', testament: 'new' } }))
				.total,
		).toBe(1)
		expect((await search('mercy', { scope: { kind: 'book', book: 'GEN' } })).total).toBe(2)
		expect(
			(
				await search('mercy', {
					translation: { kind: 'edition', id: 'jps1917' },
					scope: { kind: 'book', book: 'MAT' },
				})
			).total,
		).toBe(0)
	})
	it('caps hits in canonical order without capping counts', async () => {
		const results = await search('the')
		expect(results.total).toBe(BIBLE_SEARCH_LIMIT + 5)
		expect(results.groups.map(({ book, total, hits }) => [book, total, hits.length])).toEqual([
			['GEN', 2, 2],
			['EXO', BIBLE_SEARCH_LIMIT + 3, BIBLE_SEARCH_LIMIT - 2],
		])
	})
})
