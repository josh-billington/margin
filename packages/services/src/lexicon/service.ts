import type { Database, Hasher, Codec } from '../ports'
import { hasher, codec } from '../codecs'
import { z } from 'zod'
import { lexiconEntrySchema, strongIdSchema } from '@margin/contract/lexicon/types'
import { bdbEntriesSchema } from '@margin/contract/lexicon/bdb'
import { textEditionSchema, verseRefSchema } from '@margin/contract/bible/types'
import type { TextEdition } from '@margin/contract/bible/types'
import { decodeSpans, tokenFingerprint, LEXICON_STORAGE_VERSION } from './storage'
import type { LookupRequest, LookupResult } from '@margin/contract/lexicon/types'

const rowSchema = z.object({ data: z.string() })
const sameRef = (a: LookupRequest['start']['verse'], b: LookupRequest['start']['verse']) =>
	a.book === b.book && a.chapter === b.chapter && a.verse === b.verse
export class LexiconService {
	private constructor(
		private readonly ports: { db: Database; edition: TextEdition; hash: Hasher; decoder: Codec },
	) {}
	static async open({
		db,
		hash = hasher,
		decoder = codec,
	}: {
		db: Database
		hash?: Hasher
		decoder?: Codec
	}) {
		try {
			if ((await db.userVersion()) !== LEXICON_STORAGE_VERSION)
				throw new Error(
					`Unsupported lexicon schema version; regenerate with pnpm import:lexicon (expected ${LEXICON_STORAGE_VERSION})`,
				)
			const row = z
				.object({ edition: z.string() })
				.parse(await db.get('SELECT edition FROM metadata'))
			return new LexiconService({
				db,
				edition: textEditionSchema.parse(JSON.parse(row.edition)),
				hash,
				decoder,
			})
		} catch (error) {
			await db.close()
			throw error
		}
	}
	close() {
		return this.ports.db.close()
	}
	async getEntry(id: string) {
		const row = await this.ports.db.get('SELECT data FROM entries WHERE id=?', [id])
		return row ? lexiconEntrySchema.parse(JSON.parse(rowSchema.parse(row).data)) : null
	}
	async getBdbEntries({ id }: { id: string }) {
		const strongId = strongIdSchema.parse(id)
		if (!strongId.startsWith('H')) return []
		const row = await this.ports.db.get('SELECT data FROM bdb_entries WHERE id=?', [strongId])
		return row ? bdbEntriesSchema.parse(JSON.parse(rowSchema.parse(row).data)) : []
	}

	async lookupSelection({ text, start, end }: LookupRequest): Promise<LookupResult> {
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
		const verses = text.verses.filter((verse) =>
			selected.some((word) => sameRef(word.verse, verse.ref)),
		)
		const rows = z
			.array(
				z.object({
					...verseRefSchema.shape,
					fingerprint: z.string(),
					spans: z.instanceof(Uint8Array),
				}),
			)
			.parse(
				await this.ports.db.all(
					`SELECT book, chapter, verse, fingerprint, spans FROM verses
					WHERE (book, chapter, verse) IN (
						SELECT json_extract(value, '$.book'), json_extract(value, '$.chapter'), json_extract(value, '$.verse')
						FROM json_each(?)
					)`,
					[JSON.stringify(verses.map((verse) => verse.ref))],
				),
			)
		const byRef = new Map(rows.map((row) => [`${row.book}:${row.chapter}:${row.verse}`, row]))
		for (const verse of verses) {
			const recorded = byRef.get(`${verse.ref.book}:${verse.ref.chapter}:${verse.ref.verse}`)
			if (!recorded) return { status: 'snapshot-mismatch', spans: [] }
			if (
				JSON.stringify(text.edition) !== JSON.stringify(this.ports.edition) ||
				tokenFingerprint(verse.tokens, this.ports.hash) !== recorded.fingerprint
			)
				return { status: 'snapshot-mismatch', spans: [] }
			spans.push(
				...decodeSpans(recorded.spans, verse.ref, verse.tokens, this.ports.decoder).filter((span) =>
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
