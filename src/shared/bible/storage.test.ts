import { describe, expect, it } from 'vitest'
import fixtures from '../../../data/fixtures/tokenizer.v1.json'
import supplied from '../../../data/fixtures/supplied-words.v1.json'
import { decodeVerseTokens, encodeVerseRuns } from './storage'
import { tokenize } from './tokenizer'

describe('verse storage v2', () => {
	const cases: [string, Parameters<typeof tokenize>[0]][] = [
		...fixtures.map((fixture): [string, string] => [fixture.name, fixture.input]),
		[
			'italic word fragments and punctuation',
			[
				{ text: 'In the ', italic: false },
				{ text: 'beg', italic: true },
				{ text: 'inning', italic: false },
				{ text: ' (God), ', italic: true },
				{ text: 'bel', italic: false },
				{ text: 'ieve', italic: true },
			],
		],
		['empty verse', ''],
		['whitespace only', '  \n '],
	]
	for (const [name, input] of cases)
		it(`decodes ${name} to the tokens it was built from`, () => {
			const tokens = tokenize(input)
			expect(JSON.stringify(decodeVerseTokens(encodeVerseRuns(tokens)))).toBe(
				JSON.stringify(tokens),
			)
		})
	it('decodes supplied-word runs with italics intact', () => {
		const tokens = tokenize(supplied.runs)
		expect(JSON.stringify(decodeVerseTokens(encodeVerseRuns(tokens)))).toBe(JSON.stringify(tokens))
	})
	it('stores plain verses as one roman run', () => {
		expect(encodeVerseRuns(tokenize('In the beginning, God.'))).toBe(
			'[["In the beginning, God.",0]]',
		)
	})
})
