import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { z } from 'zod'
import { BibleService } from '../../src/main/bible/provider'
import { loadVersificationMap, mapPassage, verseKey } from '../../src/shared/bible/versification'
import { loadEditionMaps, editionPairMap } from '../../src/shared/bible/editionMaps'
import { chapterLastVerses } from '../../src/shared/bible/chapterVerses'
import { tokensToText } from '../../src/shared/bible/tokenizer'
import { decodeVerseTokens } from '../../src/shared/bible/storage'
import { bookIdSchema, translationIdSchema, verseRefSchema } from '../../src/shared/bible/types'
import { ipcContract } from '../../src/shared/ipc/contract'
import { loadRawCorpus } from './build'
import type { BookId, TranslationId } from '../../src/shared/bible/types'

async function verify() {
	const raw = await loadRawCorpus(process.cwd())
	const path = resolve('resources/bible/margin-bible.sqlite')
	const bible = new BibleService(path)
	const db = new Database(path, { readonly: true, fileMustExist: true })
	try {
		assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
		assert.deepEqual(db.pragma('foreign_key_check'), [])
		const inventory = z
			.record(translationIdSchema, z.record(z.string(), z.number()))
			.parse(JSON.parse(readFileSync('data/fixtures/inventory.v1.json', 'utf8')))
		assert.deepEqual(
			bible.listTranslations().map((edition) => edition.translationId),
			translationIdSchema.options,
		)
		for (const translation of translationIdSchema.options) {
			const rows = z
				.array(z.object({ book: z.string(), count: z.number() }))
				.parse(
					db
						.prepare(
							'SELECT book, count(*) AS count FROM verses WHERE translationId=? GROUP BY book',
						)
						.all(translation),
				)
			assert.deepEqual(
				Object.fromEntries(rows.map((row) => [row.book, row.count])),
				inventory[translation],
			)
			assert.equal(
				rows.reduce((sum, row) => sum + row.count, 0),
				Object.values(inventory[translation]).reduce((sum, count) => sum + count, 0),
			)
			const manifest = z
				.object({
					verseCount: z.number(),
					corpusRevision: z.string(),
					inventory: z.array(
						z.object({ book: z.string(), verses: z.number(), chapters: z.array(z.number()) }),
					),
				})
				.parse(JSON.parse(readFileSync(`resources/bible/${translation}.manifest.json`, 'utf8')))
			assert.equal(manifest.corpusRevision, bible.providers[translation].edition.corpusRevision)
			assert.equal(
				manifest.verseCount,
				Object.values(inventory[translation]).reduce((sum, count) => sum + count, 0),
			)
			for (const book of manifest.inventory) {
				assert.deepEqual(
					chapterLastVerses[translation][book.book],
					book.chapters.map((_, index) =>
						bible.providers[translation]
							.verseNumbers(bookIdSchema.parse(book.book), index + 1)
							.at(-1),
					),
				)
				assert.equal(book.verses, inventory[translation][book.book])
				assert.equal(
					book.chapters.reduce((sum, count) => sum + count, 0),
					book.verses,
				)
			}
			// Every persisted verse must decode to exactly the tokens re-imported from the raw source.
			const stored = new Map(
				z
					.array(
						z.object({
							book: z.string(),
							chapter: z.number(),
							verse: z.number(),
							paragraphBreakBefore: z.number(),
							content: z.string(),
						}),
					)
					.parse(
						db
							.prepare(
								'SELECT book, chapter, verse, paragraphBreakBefore, content FROM verses WHERE translationId=?',
							)
							.all(translation),
					)
					.map((row) => [`${row.book}.${row.chapter}.${row.verse}`, row]),
			)
			const expected = raw.imported[translation].flatMap((book) => book.verses)
			assert.equal(stored.size, expected.length)
			assert.equal(
				expected.length,
				Object.values(inventory[translation]).reduce((sum, count) => sum + count, 0),
			)
			for (const verse of expected) {
				const { ref } = verse
				const row = stored.get(`${ref.book}.${ref.chapter}.${ref.verse}`)
				assert(row, `${ref.book} ${ref.chapter}:${ref.verse} missing`)
				assert.equal(row.paragraphBreakBefore, Number(verse.paragraphBreakBefore))
				const tokens = decodeVerseTokens(row.content)
				assert.equal(
					JSON.stringify(tokens),
					JSON.stringify(verse.tokens),
					`${translation} ${ref.book} ${ref.chapter}:${ref.verse}`,
				)
				// Validate token index contiguity and absence of source markup.
				assert(tokens.length > 0)
				assert.deepEqual(
					tokens.map((token) => token.i),
					tokens.map((_, index) => index),
				)
				assert(!/[\\<>]|strong=/.test(tokensToText(tokens)))
			}
		}
		for (const [reference, translation, expectedLabel] of [
			['Amos 1:3', 'kjv', 'Amos 1:3'],
			['Am 1:3-5', 'kjv', 'Amos 1:3–5'],
			['Amos 1', 'kjv', 'Amos 1:1–15'],
			['Romans 8:28-9:5', 'kjv', 'Romans 8:28–9:5'],
			['KJV Joel 2:28', 'jps1917', 'Joel 2:28'],
			['JPS Joel 3', 'kjv', 'Joel 3:1–5'],
			['JPS Malachi 3', 'kjv', 'Malachi 3:1–24'],
			['Ps 3', 'jps1917', 'Psalms 3:1–9'],
		] satisfies [string, TranslationId, string][]) {
			const preview = bible.resolveReference(reference, translation)
			if (preview.kind !== 'resolved') throw new Error(preview.message)
			assert.equal(preview.label, expectedLabel)
			ipcContract.bible.resolveReference.response.parse({ ok: true, data: preview })
			const passage = await bible.getPassage(preview.translation, preview.ranges)
			assert(passage.verses.length > 0)
			ipcContract.bible.getPassage.response.parse({ ok: true, data: passage })
		}
		for (const reference of [
			'Amos 1:16',
			'JPS Malachi 4:1',
			'JPS Joel 2:28',
			'Rom 8:28-7:1',
			'Jo 1:1',
			'JPS Matthew 99:1',
		])
			assert.equal(bible.resolveReference(reference, 'kjv').kind, 'error', reference)
		const fallback = bible.resolveReference('JPS Romans 8:28', 'kjv')
		assert.equal(fallback.kind, 'resolved')
		if (fallback.kind === 'resolved') {
			assert.equal(fallback.translation, 'kjv')
			assert(fallback.notice?.includes('confirm KJV'))
			assert.equal(fallback.numberingSystem, 'kjv')
		}
		await assert.rejects(
			bible.getPassage('jps1917', [
				{
					start: { book: 'MAT', chapter: 1, verse: 1 },
					end: { book: 'MAT', chapter: 1, verse: 2 },
				},
			]),
			RangeError,
		)
		const kjv = bible.resolveReference('Genesis 1:2', 'kjv')
		assert.equal(kjv.kind, 'resolved')
		if (kjv.kind === 'resolved') {
			const verse = (await bible.getPassage('kjv', kjv.ranges)).verses[0]
			assert(
				verse?.tokens.some((token) => token.runs.some((run) => run.italic && run.text === 'was')),
			)
			assert(!tokensToText(verse?.tokens ?? []).includes('Heb.'))
		}
		const boundaries = (translation: TranslationId, book: BookId, chapter: number) =>
			bible.providers[translation].verseNumbers(book, chapter)
		const map = loadVersificationMap(
			JSON.parse(readFileSync('data/versification/kjv-jps1917.v1.json', 'utf8')),
			bible.listTranslations(),
			boundaries,
		)
		for (const translation of ['kjv', 'jps1917'] as const) {
			const classified = new Set(
				[
					...map.entries.flatMap((entry) => entry[translation]),
					...map.unmapped
						.filter((entry) => entry.translationId === translation)
						.map((entry) => entry.ref),
				].map(verseKey),
			)
			const actual = z
				.array(verseRefSchema)
				.parse(
					db
						.prepare('SELECT book,chapter,verse FROM verses WHERE translationId=?')
						.all(translation),
				)
			assert.equal(classified.size, actual.length)
			assert(actual.every((ref) => classified.has(verseKey(ref))))
		}
		function mapped(reference: string, translation: TranslationId) {
			const parsed = bible.resolveReference(reference, translation)
			if (parsed.kind !== 'resolved') throw new Error(parsed.message)
			return mapPassage(map, translation, parsed.ranges, boundaries)
		}
		assert.deepEqual(mapped('Malachi 4:1-6', 'kjv').ranges, [
			{
				start: { book: 'MAL', chapter: 3, verse: 19 },
				end: { book: 'MAL', chapter: 3, verse: 24 },
			},
		])
		assert.deepEqual(mapped('Malachi 3:19-24', 'jps1917').ranges, [
			{ start: { book: 'MAL', chapter: 4, verse: 1 }, end: { book: 'MAL', chapter: 4, verse: 6 } },
		])
		assert.deepEqual(mapped('Joel 2:28-3:2', 'kjv').ranges, [
			{ start: { book: 'JOL', chapter: 3, verse: 1 }, end: { book: 'JOL', chapter: 4, verse: 2 } },
		])
		assert.deepEqual(mapped('Psalm 3:1', 'kjv').ranges[0]?.start, {
			book: 'PSA',
			chapter: 3,
			verse: 2,
		})
		assert.equal(mapped('Psalm 3:1', 'jps1917').kind, 'incomplete')
		// The service wrapper the renderer reaches over IPC must agree with the direct mapping.
		const malachi = bible.resolveReference('Malachi 4:1-6', 'kjv')
		if (malachi.kind !== 'resolved') throw new Error(malachi.message)
		assert.deepEqual(
			bible.mapPassage('kjv', malachi.ranges, 'jps1917'),
			mapPassage(map, 'kjv', malachi.ranges, boundaries),
		)
		assert.equal(mapped('Psalm 51:1-2', 'jps1917').unmapped.length, 2)
		assert.equal(mapped('Psalm 13:5', 'kjv').kind, 'confirmation-required')
		assert.equal(mapped('Psalm 13:5-6', 'kjv').kind, 'mapped')
		assert.deepEqual(mapped('Psalm 13:6', 'jps1917').ranges, [
			{
				start: { book: 'PSA', chapter: 13, verse: 5 },
				end: { book: 'PSA', chapter: 13, verse: 6 },
			},
		])
		assert.equal(mapped('Exodus 20:13', 'kjv').kind, 'confirmation-required')
		assert.deepEqual(mapped('Exodus 20:13', 'jps1917').ranges[0], {
			start: { book: 'EXO', chapter: 20, verse: 13 },
			end: { book: 'EXO', chapter: 20, verse: 16 },
		})
		assert.equal(mapped('Nehemiah 7:68', 'kjv').kind, 'incomplete')
		assert.equal(mapped('Matthew 1:1', 'kjv').kind, 'incomplete')
		assert.throws(() =>
			loadVersificationMap(
				JSON.parse(readFileSync('data/versification/kjv-jps1917.v1.json', 'utf8')),
				bible.listTranslations().map((edition) => ({ ...edition, corpusRevision: 'changed' })),
				boundaries,
			),
		)
		const editionMaps = loadEditionMaps(
			JSON.parse(readFileSync('data/versification/edition-maps.v1.json', 'utf8')),
			bible.listTranslations(),
		)
		for (const pair of editionMaps.maps) {
			const pairMap = editionPairMap(
				editionMaps,
				pair.source,
				pair.target,
				(id) => bible.providers[id].allRefs(),
				boundaries,
			)
			for (const id of [pair.source, pair.target]) {
				const classified = [
					...pairMap.entries.flatMap((entry) => entry[id]),
					...pairMap.unmapped
						.filter((entry) => entry.translationId === id)
						.map((entry) => entry.ref),
				].map(verseKey)
				assert.equal(new Set(classified).size, bible.providers[id].allRefs().length)
			}
			for (const [from, to] of [
				[pair.source, pair.target],
				[pair.target, pair.source],
			] as const) {
				const parsed = bible.resolveReference('Genesis 1:27', from)
				assert(parsed.kind === 'resolved')
				const mapped = bible.mapPassage(from, parsed.ranges, to)
				assert.equal(mapped.kind, 'mapped')
				assert.equal(mapped.translation, to)
				ipcContract.bible.mapPassage.response.parse({ ok: true, data: mapped })
				assert((await bible.getPassage(to, mapped.ranges)).verses.length > 0)
			}
		}
		for (const id of ['bsb', 'web', 'asv'] as const) {
			const preview = bible.resolveReference(`${id.toUpperCase()} Genesis 1:27`, 'jps1917')
			assert(preview.kind === 'resolved')
			assert.equal(preview.translation, id)
			const passage = await bible.getPassage(id, preview.ranges)
			const content = tokensToText(passage.verses[0]!.tokens)
			assert(/male and female/i.test(content), `${id} lost the poetry continuation: ${content}`)
		}
		function switchEdition(reference: string, from: TranslationId, to: TranslationId) {
			const parsed = bible.resolveReference(reference, from)
			assert(parsed.kind === 'resolved')
			return bible.mapPassage(from, parsed.ranges, to)
		}
		for (const id of ['kjv', 'bsb', 'asv'] as const) {
			assert.deepEqual(switchEdition('Romans 16:25-27', id, 'web').ranges, [
				{
					start: { book: 'ROM', chapter: 14, verse: 24 },
					end: { book: 'ROM', chapter: 14, verse: 26 },
				},
			])
			assert.deepEqual(switchEdition('Romans 14:24-26', 'web', id).ranges, [
				{
					start: { book: 'ROM', chapter: 16, verse: 25 },
					end: { book: 'ROM', chapter: 16, verse: 27 },
				},
			])
		}
		assert.equal(bible.resolveReference('Romans 16:25', 'web').kind, 'error')
		for (const id of ['bsb', 'asv'] as const) {
			assert.equal(bible.resolveReference('Matthew 17:21', id).kind, 'error')
			assert.equal(switchEdition('Matthew 17:20-22', 'kjv', id).kind, 'incomplete')
			assert.equal(switchEdition('Exodus 20:13', id, 'kjv').kind, 'mapped')
		}
		assert.equal(switchEdition('Psalm 13:5', 'web', 'jps1917').kind, 'confirmation-required')
		assert.equal(switchEdition('Matthew 1:1', 'bsb', 'jps1917').kind, 'incomplete')
		console.info(
			'Corpus, providers, parser, IPC response schemas, inventories, and every mapping reference verified.',
		)
	} finally {
		bible.close()
		db.close()
	}
}
void verify().catch((error: unknown) => {
	console.error(error)
	process.exitCode = 1
})
