import Database from 'better-sqlite3'
import { z } from 'zod'
import { books } from '../../shared/bible/books'
import { mapPassage } from '../../shared/bible/versification'
import type { VersificationMap } from '../../shared/bible/versification'
import versificationJson from '../../../data/versification/edition-maps.v1.json'
import { loadEditionMaps, editionPairMap } from '../../shared/bible/editionMaps'
import type { EditionMaps } from '../../shared/bible/editionMaps'
import { parseReference } from '../../shared/bible/reference'
import type { InsertionPreview } from '../../shared/bible/reference'
import {
	bookIdSchema,
	passageRangeSchema,
	textEditionSchema,
	verseRefSchema,
	translationIdSchema,
} from '../../shared/bible/types'
import { STORAGE_VERSION, decodeVerseTokens } from '../../shared/bible/storage'
import type {
	BibleProvider,
	BookId,
	PassageRange,
	PassageText,
	TextEdition,
	TranslationId,
	VerseRef,
} from '../../shared/bible/types'

const rowSchema = z.object({
	book: bookIdSchema,
	chapter: z.number().int(),
	verse: z.number().int(),
	paragraphBreakBefore: z.number().int().min(0).max(1),
	content: z.string(),
})

export class SqliteBibleProvider implements BibleProvider {
	readonly edition: TextEdition
	readonly name: string
	readonly books: BookId[]
	constructor(
		private readonly db: Database.Database,
		translationId: TranslationId,
	) {
		this.edition = textEditionSchema.parse(
			db.prepare('SELECT * FROM editions WHERE translationId = ?').get(translationId),
		)
		this.name = this.edition.editionName
		this.books = z
			.array(z.object({ id: bookIdSchema }))
			.parse(
				db
					.prepare('SELECT id FROM books WHERE translationId = ? ORDER BY ordinal')
					.all(translationId),
			)
			.map((book) => book.id)
	}

	allRefs(): VerseRef[] {
		return z
			.array(verseRefSchema)
			.parse(
				this.db
					.prepare(
						'SELECT book,chapter,verse FROM verses WHERE translationId=? ORDER BY book,chapter,verse',
					)
					.all(this.edition.translationId),
			)
	}

	private chapters = new Map<string, number[]>()
	verseNumbers(book: BookId, chapter: number): number[] {
		const key = `${book}:${chapter}`
		const cached = this.chapters.get(key)
		if (cached) return cached
		const verses = z
			.array(z.object({ verse: z.number().int().nonnegative() }))
			.parse(
				this.db
					.prepare(
						'SELECT verse FROM verses WHERE translationId = ? AND book = ? AND chapter = ? ORDER BY verse',
					)
					.all(this.edition.translationId, book, chapter),
			)
			.map((row) => row.verse)
		this.chapters.set(key, verses)
		return verses
	}

	async getPassage(input: readonly PassageRange[]): Promise<PassageText> {
		const ranges = z.array(passageRangeSchema).min(1).parse(input)
		const selected = new Map<string, PassageText['verses'][number]>()
		for (const range of ranges) {
			if (
				!this.verseNumbers(range.start.book, range.start.chapter).includes(range.start.verse) ||
				!this.verseNumbers(range.end.book, range.end.chapter).includes(range.end.verse)
			)
				throw new RangeError('That verse does not exist in this edition.')
			for (let chapter = range.start.chapter; chapter <= range.end.chapter; chapter++) {
				if (!this.verseNumbers(range.start.book, chapter).length)
					throw new RangeError('That chapter does not exist in this edition.')
			}
			const rows = this.db
				.prepare(
					`SELECT book, chapter, verse, paragraphBreakBefore, content FROM verses
				WHERE translationId = ? AND book = ? AND (chapter > ? OR (chapter = ? AND verse >= ?))
				AND (chapter < ? OR (chapter = ? AND verse <= ?)) ORDER BY chapter, verse`,
				)
				.all(
					this.edition.translationId,
					range.start.book,
					range.start.chapter,
					range.start.chapter,
					range.start.verse,
					range.end.chapter,
					range.end.chapter,
					range.end.verse,
				)
			for (const input of rows) {
				const row = rowSchema.parse(input)
				selected.set(`${row.book}.${row.chapter}.${row.verse}`, {
					ref: { book: row.book, chapter: row.chapter, verse: row.verse },
					paragraphBreakBefore: Boolean(row.paragraphBreakBefore),
					tokens: decodeVerseTokens(row.content),
				})
			}
		}
		const verses = [...selected.values()].sort(
			(a, b) =>
				this.books.indexOf(a.ref.book) - this.books.indexOf(b.ref.book) ||
				a.ref.chapter - b.ref.chapter ||
				a.ref.verse - b.ref.verse,
		)
		return { edition: this.edition, ranges, verses }
	}
}

export class BibleService {
	private readonly db: Database.Database
	readonly providers: Record<TranslationId, SqliteBibleProvider>
	constructor(path: string) {
		this.db = new Database(path, { readonly: true, fileMustExist: true })
		try {
			const storage = this.db.pragma('user_version', { simple: true })
			if (storage !== STORAGE_VERSION)
				throw new Error(
					`Bible storage version ${String(storage)} is not supported (expected ${STORAGE_VERSION}). Run yarn import:bible.`,
				)
			this.providers = {
				bsb: new SqliteBibleProvider(this.db, 'bsb'),
				web: new SqliteBibleProvider(this.db, 'web'),
				asv: new SqliteBibleProvider(this.db, 'asv'),
				kjv: new SqliteBibleProvider(this.db, 'kjv'),
				jps1917: new SqliteBibleProvider(this.db, 'jps1917'),
			}
		} catch (error) {
			this.db.close()
			throw error
		}
	}
	private maps?: EditionMaps
	private pairMaps = new Map<string, VersificationMap>()
	mapPassage(from: TranslationId, ranges: readonly PassageRange[], to: TranslationId) {
		const boundaries = (translation: TranslationId, book: BookId, chapter: number) =>
			this.providers[translation].verseNumbers(book, chapter)
		this.maps ??= loadEditionMaps(versificationJson, this.listTranslations())
		const key = [from, to].sort().join(':')
		let map = this.pairMaps.get(key)
		if (!map) {
			map = editionPairMap(this.maps, from, to, (id) => this.providers[id].allRefs(), boundaries)
			this.pairMaps.set(key, map)
		}
		return mapPassage(map, from, ranges, boundaries, to)
	}
	close() {
		this.db.close()
	}
	listTranslations() {
		return translationIdSchema.options.map((id) => this.providers[id].edition)
	}
	resolveReference(
		reference: string,
		translationId: TranslationId,
		oldTestamentTranslationId?: TranslationId,
	): InsertionPreview {
		const parsed = parseReference(
			reference,
			translationId,
			(translation, book, chapter) => this.providers[translation].verseNumbers(book, chapter),
			oldTestamentTranslationId,
		)
		if (parsed.kind === 'error') return parsed
		const edition = this.providers[parsed.translation].edition
		return { ...parsed, edition, numberingSystem: edition.versificationId }
	}
	getPassage(translationId: TranslationId, ranges: readonly PassageRange[]) {
		return this.providers[translationId].getPassage(ranges)
	}
	refExists(translationId: TranslationId, ref: VerseRef): boolean {
		return (
			books.some((book) => book.id === ref.book) &&
			this.providers[translationId].verseNumbers(ref.book, ref.chapter).includes(ref.verse)
		)
	}
}
