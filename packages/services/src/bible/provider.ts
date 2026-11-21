import type { Database } from '../ports'
import { z } from 'zod'
import { books } from '@margin/contract/bible/books'
import { expandRanges, mapPassage, verseKey } from '@margin/contract/bible/versification'
import versificationJson from './edition-maps.v1.json'
import { loadEditionMaps, editionPairMap } from '@margin/contract/bible/editionMaps'
import type { EditionMaps } from '@margin/contract/bible/editionMaps'
import { parseReference } from '@margin/contract/bible/reference'
import type { InsertionPreview } from '@margin/contract/bible/reference'
import {
	bookIdSchema,
	textEditionSchema,
	verseRefSchema,
	translationIdSchema,
} from '@margin/contract/bible/types'
import { STORAGE_VERSION, decodeVerseTokens } from '@margin/contract/bible/storage'
import type {
	BibleProvider,
	BookId,
	PassageRange,
	PassageText,
	TextEdition,
	TranslationId,
	VerseRef,
} from '@margin/contract/bible/types'

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
	private readonly db: Database
	private constructor(args: {
		db: Database
		edition: TextEdition
		books: BookId[]
		refs: VerseRef[]
	}) {
		this.db = args.db
		this.edition = args.edition
		this.name = this.edition.editionName
		this.books = args.books
		this.refs = args.refs
		for (const ref of args.refs) {
			const key = `${ref.book}:${ref.chapter}`
			const verses = this.chapters.get(key) ?? []
			verses.push(ref.verse)
			this.chapters.set(key, verses)
		}
	}
	static async open({ db, translationId }: { db: Database; translationId: TranslationId }) {
		const edition = textEditionSchema.parse(
			await db.get('SELECT * FROM editions WHERE translationId = ?', [translationId]),
		)
		const books = z
			.array(z.object({ id: bookIdSchema }))
			.parse(
				await db.all('SELECT id FROM books WHERE translationId = ? ORDER BY ordinal', [
					translationId,
				]),
			)
			.map((book) => book.id)
		const refs = z
			.array(verseRefSchema)
			.parse(
				await db.all(
					'SELECT book,chapter,verse FROM verses WHERE translationId=? ORDER BY book,chapter,verse',
					[translationId],
				),
			)
		return new SqliteBibleProvider({ db, edition, books, refs })
	}
	private readonly refs: VerseRef[]
	allRefs(): VerseRef[] {
		return this.refs
	}
	private chapters = new Map<string, number[]>()
	verseNumbers(book: BookId, chapter: number): number[] {
		return this.chapters.get(`${book}:${chapter}`) ?? []
	}

	async getPassage(input: readonly PassageRange[]): Promise<PassageText> {
		const ranges = [...input]
		const selected = new Map<string, PassageText['verses'][number]>()
		for (const range of ranges) {
			if (
				!this.verseNumbers(range.start.book, range.start.chapter).includes(range.start.verse) ||
				!this.verseNumbers(range.end.book, range.end.chapter).includes(range.end.verse)
			)
				throw new RangeError(
					'This translation does not contain that verse. Choose another verse or translation.',
				)
			for (let chapter = range.start.chapter; chapter <= range.end.chapter; chapter++) {
				if (!this.verseNumbers(range.start.book, chapter).length)
					throw new RangeError(
						'This translation does not contain that chapter. Choose another chapter or translation.',
					)
			}
			const rows = await this.db.all(
				`SELECT book, chapter, verse, paragraphBreakBefore, content FROM verses
				WHERE translationId = ? AND book = ? AND (chapter > ? OR (chapter = ? AND verse >= ?))
				AND (chapter < ? OR (chapter = ? AND verse <= ?)) ORDER BY chapter, verse`,
				[
					this.edition.translationId,
					range.start.book,
					range.start.chapter,
					range.start.chapter,
					range.start.verse,
					range.end.chapter,
					range.end.chapter,
					range.end.verse,
				],
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

export async function checkBibleStorage(db: Database) {
	const storage = await db.userVersion()
	if (storage !== STORAGE_VERSION)
		throw new Error(
			`Bible storage version ${String(storage)} is not supported (expected ${STORAGE_VERSION}). Run pnpm import:bible.`,
		)
}

export class BibleService {
	private readonly db: Database
	readonly providers: Record<TranslationId, SqliteBibleProvider>
	private constructor({
		db,
		providers,
	}: {
		db: Database
		providers: Record<TranslationId, SqliteBibleProvider>
	}) {
		this.db = db
		this.providers = providers
	}
	static async open(db: Database) {
		try {
			await checkBibleStorage(db)
			return await BibleService.loadInventory(db)
		} catch (error) {
			await db.close()
			throw error
		}
	}

	static async loadInventory(db: Database) {
		const providers = {
			bsb: await SqliteBibleProvider.open({ db, translationId: 'bsb' }),
			web: await SqliteBibleProvider.open({ db, translationId: 'web' }),
			asv: await SqliteBibleProvider.open({ db, translationId: 'asv' }),
			kjv: await SqliteBibleProvider.open({ db, translationId: 'kjv' }),
			jps1917: await SqliteBibleProvider.open({ db, translationId: 'jps1917' }),
		}
		return new BibleService({ db, providers })
	}

	private maps?: EditionMaps
	mapPassage(from: TranslationId, ranges: readonly PassageRange[], to: TranslationId) {
		const boundaries = (translation: TranslationId, book: BookId, chapter: number) =>
			this.providers[translation].verseNumbers(book, chapter)
		this.maps ??= loadEditionMaps(versificationJson, this.listTranslations())
		// Identity mappings only need the selected references; corpus coverage is verified in tests.
		const selected = [
			...new Map(
				expandRanges(ranges, from, boundaries).map((ref) => [verseKey(ref), ref]),
			).values(),
		].sort((a, b) =>
			a.book < b.book ? -1 : a.book > b.book ? 1 : a.chapter - b.chapter || a.verse - b.verse,
		)
		const map = editionPairMap(this.maps, from, to, (id) =>
			selected.filter((ref) => boundaries(id, ref.book, ref.chapter).includes(ref.verse)),
		)
		return mapPassage(map, from, ranges, boundaries, to)
	}
	close() {
		return this.db.close()
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
