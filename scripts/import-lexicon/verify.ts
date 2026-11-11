import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'
import { resolve } from 'node:path'
import type { Token } from '../../src/shared/bible/types'
import { BibleService } from '../../src/main/bible/provider'
import { LexiconService } from '../../src/main/lexicon/service'

async function verify() {
	const temporary = mkdtempSync(join(tmpdir(), 'margin-lexicon-version-'))
	try {
		const path = join(temporary, 'old.sqlite')
		const db = new Database(path)
		db.pragma('user_version = 1')
		db.close()
		assert.throws(() => new LexiconService(path), /Unsupported lexicon schema version; regenerate/)
	} finally {
		rmSync(temporary, { recursive: true, force: true })
	}
	const bible = new BibleService(resolve('resources/bible/margin-bible.sqlite'))
	const lexicon = new LexiconService(resolve('resources/lexicon/margin-lexicon.sqlite'))
	try {
		for (const [book, chapter, verse, english, id] of [
			['GEN', 1, 1, 'created', 'H1254'],
			['JHN', 1, 1, 'Word', 'G3056'],
		] as const) {
			const ref = { book, chapter, verse }
			const text = await bible.getPassage('kjv', [{ start: ref, end: ref }])
			const token = text.verses[0]?.tokens.find(
				(token) => token.runs.map((run) => run.text).join('') === english,
			)
			assert(token)
			const target = { verse: ref, token: token.i }
			assert.equal(
				lexicon.lookupSelection({ text, start: target, end: target }).spans[0]?.ids[0],
				id,
			)
			assert(lexicon.getEntry(id)?.definition)
			assert.equal(lexicon.getEntry(id[0] + '0' + id.slice(1))?.id, id)
			for (const field of [
				'editionName',
				'versificationId',
				'corpusRevision',
				'tokenizerVersion',
			] as const) {
				const old = structuredClone(text)
				old.edition[field] = 'old'
				assert.deepEqual(lexicon.lookupSelection({ text: old, start: target, end: target }), {
					status: 'snapshot-mismatch',
					spans: [],
				})
			}
			for (const mutate of [
				(token: Token) => {
					token.trailing += '!'
				},
				(token: Token) => {
					token.leading += '“'
				},
				(token: Token) => {
					token.spaceAfter += ' '
				},
				(token: Token) => {
					token.i += 100
				},
				(token: Token) => {
					assert(token.runs[0])
					token.runs[0].text += 'x'
				},
				(token: Token) => {
					assert(token.runs[0])
					token.runs[0].italic = !token.runs[0].italic
				},
			]) {
				const changed = structuredClone(text)
				const first = changed.verses[0]?.tokens[0]
				assert(first)
				mutate(first)
				assert.deepEqual(lexicon.lookupSelection({ text: changed, start: target, end: target }), {
					status: 'snapshot-mismatch',
					spans: [],
				})
			}
			for (const translationId of ['jps1917', 'bsb', 'web', 'asv'] as const) {
				const unsupported = { ...text, edition: { ...text.edition, translationId } }
				assert.deepEqual(
					lexicon.lookupSelection({ text: unsupported, start: target, end: target }),
					{ status: 'unsupported-translation', spans: [] },
				)
			}
		}
		for (const [book, chapter, verse, phrase, id] of [
			['GEN', 16, 12, 'man’s hand', 'H3027'],
			['JHN', 18, 4, 'seek ye', 'G2212'],
		] as const) {
			const ref = { book, chapter, verse }
			const text = await bible.getPassage('kjv', [{ start: ref, end: ref }])
			const tokens = text.verses[0]?.tokens ?? []
			const at = tokens.findIndex(
				(token, index) =>
					`${token.runs.map((run) => run.text).join('')} ${tokens[index + 1]?.runs.map((run) => run.text).join('')}` ===
					phrase,
			)
			assert(at >= 0, phrase)
			for (const token of [at, at + 1]) {
				const target = { verse: ref, token }
				const span = lexicon
					.lookupSelection({ text, start: target, end: target })
					.spans.find((span) => span.ids.includes(id))
				assert.equal(span?.text, phrase)
				assert.equal(span?.last, at + 1)
			}
		}
		console.info(
			'Lexicon acceptance: created H1254, Word G3056, phrase spans, manual lookup, snapshot safety verified',
		)
	} finally {
		bible.close()
		lexicon.close()
	}
}
void verify().catch((error: unknown) => {
	console.error(error)
	process.exitCode = 1
})
