import Database from 'better-sqlite3'
import { z } from 'zod'
import { lexiconEntrySchema, strongIdSchema } from '../../shared/lexicon/types'
import { textEditionSchema } from '../../shared/bible/types'
import type { TextEdition } from '../../shared/bible/types'
import {
	decodeSpans,
	tokenFingerprint,
	LEXICON_STORAGE_VERSION,
} from '../../shared/lexicon/storage'
import type { LookupRequest, LookupResult } from '../../shared/lexicon/types'

const rowSchema = z.object({ data: z.string() })
const sameRef = (a: LookupRequest['start']['verse'], b: LookupRequest['start']['verse']) =>
	a.book === b.book && a.chapter === b.chapter && a.verse === b.verse
export class LexiconService {
	private readonly db: Database.Database
	private readonly edition: TextEdition
	constructor(path: string) {
		this.db = new Database(path, { readonly: true, fileMustExist: true })
		if (this.db.pragma('user_version', { simple: true }) !== LEXICON_STORAGE_VERSION) {
			this.db.close()
			throw new Error(
				`Unsupported lexicon schema version; regenerate with yarn import:lexicon (expected ${LEXICON_STORAGE_VERSION})`,
			)
		}
		try {
			const row = z
				.object({ edition: z.string() })
				.parse(this.db.prepare('SELECT edition FROM metadata').get())
			this.edition = textEditionSchema.parse(JSON.parse(row.edition))
		} catch (error) {
			this.db.close()
			throw error
		}
	}
	close() {
		this.db.close()
	}
	getEntry(id: string) {
		const row = this.db.prepare('SELECT data FROM entries WHERE id=?').get(strongIdSchema.parse(id))
		return row ? lexiconEntrySchema.parse(JSON.parse(rowSchema.parse(row).data)) : null
	}
	lookupSelection({ text, start, end }: LookupRequest): LookupResult {
		if (text.edition.translationId !== 'kjv')
			return { status: 'unsupported-translation', spans: [] }
		const words = text.verses.flatMap((verse) =>
			verse.tokens.map((token) => ({ verse: verse.ref, token: token.i })),
		)
		const index = (target: typeof start) =>
			words.findIndex((word) => sameRef(word.verse, target.verse) && word.token === target.token)
		const a = index(start),
			b = index(end)
		if (a < 0 || b < 0) throw new RangeError('Word is absent from the verse snapshot')
		const selected = words.slice(Math.min(a, b), Math.max(a, b) + 1)
		const spans: LookupResult['spans'] = []
		for (const verse of text.verses.filter((verse) =>
			selected.some((word) => sameRef(word.verse, verse.ref)),
		)) {
			const row = this.db
				.prepare('SELECT fingerprint, spans FROM verses WHERE book=? AND chapter=? AND verse=?')
				.get(verse.ref.book, verse.ref.chapter, verse.ref.verse)
			if (!row) return { status: 'snapshot-mismatch', spans: [] }
			const recorded = z.object({ fingerprint: z.string(), spans: z.instanceof(Buffer) }).parse(row)
			if (
				JSON.stringify(text.edition) !== JSON.stringify(this.edition) ||
				tokenFingerprint(verse.tokens) !== recorded.fingerprint
			)
				return { status: 'snapshot-mismatch', spans: [] }
			spans.push(
				...decodeSpans(recorded.spans, verse.ref, verse.tokens).filter((span) =>
					selected.some(
						(word) =>
							sameRef(word.verse, span.ref) && word.token >= span.first && word.token <= span.last,
					),
				),
			)
		}
		return { status: 'matched', spans }
	}
}
