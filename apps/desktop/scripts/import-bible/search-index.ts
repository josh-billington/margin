import type Database from 'better-sqlite3'
import Sqlite from 'better-sqlite3'
import { copyFile, mkdtemp, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { books } from '@shared/bible/books'
import { STORAGE_VERSION, decodeVerseText } from '@shared/bible/storage'
import { translationIdSchema, verseRefSchema } from '@shared/bible/types'
import {
	BOOK_STRIDE,
	CHAPTER_STRIDE,
	SEARCH_TABLES,
	createSearchTable,
} from '@margin/services/bible/searchIndex'
import { normalizeSearchText } from '@margin/services/bible/searchText'

const sourceRow = verseRefSchema.extend({
	ordinal: z.number().int().nonnegative(),
	content: z.string(),
})

export function buildSearchIndex(db: Database.Database) {
	db.transaction(() => {
		const verses = db.prepare<[string], unknown>(`
			SELECT books.ordinal, verses.book, verses.chapter, verses.verse, verses.content
			FROM verses JOIN books ON books.translationId = verses.translationId AND books.id = verses.book
			WHERE verses.translationId = ? ORDER BY books.ordinal, verses.chapter, verses.verse
		`)
		for (const id of translationIdSchema.options) {
			const table = SEARCH_TABLES[id]
			db.exec(`DROP TABLE IF EXISTS ${table}; ${createSearchTable(id)}`)
			const insert = db.prepare(`INSERT INTO ${table} (rowid, text) VALUES (?, ?)`)
			for (const row of verses.all(id)) {
				const { book, ordinal, chapter, verse, content } = sourceRow.parse(row)
				if (books[ordinal]?.id !== book || chapter >= CHAPTER_STRIDE || verse >= CHAPTER_STRIDE)
					throw new Error(`Cannot index ${id} ${book} ${chapter}:${verse}`)
				const rowid = ordinal * BOOK_STRIDE + chapter * CHAPTER_STRIDE + verse
				insert.run(rowid, normalizeSearchText(decodeVerseText(content)))
			}
			db.exec(
				`INSERT INTO ${table} (${table}) VALUES ('optimize'); INSERT INTO ${table} (${table}) VALUES ('integrity-check')`,
			)
		}
		db.prepare('UPDATE editions SET storageVersion = ?').run(STORAGE_VERSION)
		db.pragma(`user_version = ${STORAGE_VERSION}`)
	})()
}

export async function reindexBible(path: string) {
	const before = (await stat(path)).size
	const folder = await mkdtemp(join(dirname(path), '.bible-search-'))
	const draft = join(folder, 'margin-bible.sqlite')
	try {
		await copyFile(path, draft)
		const db = new Sqlite(draft, { fileMustExist: true })
		try {
			const version = db.pragma('user_version', { simple: true })
			if (version !== 2 && version !== STORAGE_VERSION)
				throw new Error(`Cannot reindex Bible storage version ${String(version)}`)
			buildSearchIndex(db)
			db.exec('VACUUM')
			if (db.pragma('integrity_check', { simple: true }) !== 'ok')
				throw new Error('SQLite integrity check failed')
		} finally {
			db.close()
		}
		await rename(draft, path)
		console.info(`Bible database: ${before} → ${(await stat(path)).size} bytes`)
	} finally {
		await rm(folder, { recursive: true, force: true })
	}
}
