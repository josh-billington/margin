import { describe, expect, it } from 'vitest'
import { strongIdSchema } from './types'
import { annotatedTokens, assertTokenEquality } from '../../../scripts/import-lexicon/spans'
import { parseDictionary } from '../../../scripts/import-lexicon/dictionaries'
import { encodeSpans, decodeSpans, tokenFingerprint } from './storage'
import { tokenize } from '../bible/tokenizer'

const ref = { book: 'GEN', chapter: 1, verse: 1 } as const

describe('Strong’s identifiers', () => {
	it.each([
		['H0430', 'H430'],
		['H01254', 'H1254'],
		['g03056', 'G3056'],
		[' H1254 ', 'H1254'],
	])('normalizes %s to %s', (input, expected) => expect(strongIdSchema.parse(input)).toBe(expected))
	it.each(['1254', 'H0', 'G', 'H12x', 'X123', 'H-3'])('rejects %s', (input) =>
		expect(strongIdSchema.safeParse(input).success).toBe(false),
	)
})

describe('source spans into display tokens', () => {
	it('retains punctuation and supplied words without giving them inferred tags', () => {
		const { tokens, spans } = annotatedTokens(
			ref,
			'\\w In|strong="H1"\\w* \\add the\\add* \\w beginning|strong="H7225"\\w*, \\w created|strong="H1254 H01254"\\w*.',
		)
		expect(tokens.map((token) => token.runs.map((run) => run.text).join(''))).toEqual([
			'In',
			'the',
			'beginning',
			'created',
		])
		expect(tokens[1]?.runs).toEqual([{ text: 'the', italic: true }])
		expect(tokens[2]?.trailing).toBe(',')
		expect(spans.map((span) => [span.first, span.last, span.ids])).toEqual([
			[0, 0, ['H1']],
			[2, 2, ['H7225']],
			[3, 3, ['H1254']],
		])
	})
	it.each([
		["man's hand", 'H3027'],
		['seek ye', 'G2212'],
	])('keeps phrase %s together', (phrase, id) => {
		const result = annotatedTokens(ref, `a \\w ${phrase}|strong="${id}"\\w*, now.`)
		expect(result.spans).toEqual([{ ref, first: 1, last: 2, text: phrase, ids: [id] }])
		assertTokenEquality(result.tokens, tokenize(`a ${phrase}, now.`), 'phrase')
	})
	it('fails loudly when even punctuation or italics differs', () => {
		expect(() => assertTokenEquality(tokenize('word,'), tokenize('word.'), 'GEN 1:1')).toThrow(
			'Lexicon token mismatch at GEN 1:1',
		)
	})
})

describe('dictionary data parsing', () => {
	it('parses JSON and never accepts executable JavaScript', () => {
		const wrapper = '/** Notice */\nvar strongsHebrewDictionary = '
		expect(
			parseDictionary(
				wrapper +
					'{"H1":{"lemma":"אָב","strongs_def":"father"}};\nmodule.exports = strongsHebrewDictionary;',
				'Hebrew',
			)[0]?.definition,
		).toBe('father')
		expect(() => parseDictionary(wrapper + '{"H1": (() => { throw 1 })()};', 'Hebrew')).toThrow()
		expect(() => parseDictionary(wrapper + '{};\nprocess.exit();', 'Hebrew')).toThrow()
	})
})

describe('compact annotation storage', () => {
	it('round trips phrases, multiple ids, untagged words and exact source text', () => {
		const { tokens, spans } = annotatedTokens(ref, '\\w seek ye|strong="G2212 H1"\\w*, now.')
		spans.push({ ref, first: 2, last: 2, ids: ['H2'], text: 'source spelling' })
		expect(decodeSpans(encodeSpans(spans, tokens), ref, tokens)).toEqual(spans)
		expect(decodeSpans(encodeSpans([], tokens), ref, tokens)).toEqual([])
	})
	it('fingerprints every part of the token snapshot', () => {
		const tokens = tokenize('a word,')
		const fingerprint = tokenFingerprint(tokens)
		expect(fingerprint).toHaveLength(32)
		expect(tokenFingerprint(structuredClone(tokens))).toBe(fingerprint)
		for (const change of [
			() => tokenize('a Word,'),
			() => tokenize('a word.'),
			() => tokenize('a  word,'),
			() => tokenize([{ text: 'a word,', italic: true }]),
			() => tokens.map((token) => ({ ...token, i: token.i + 1 })),
		])
			expect(tokenFingerprint(change())).not.toBe(fingerprint)
	})
})
