import { describe, expect, it } from 'vitest'
import fixtures from '../../../data/fixtures/tokenizer.v1.json'
import supplied from '../../../data/fixtures/supplied-words.v1.json'
import sourceMarkup from '../../../data/fixtures/source-markup.v1.json'
import { tokenize, tokensToText } from './tokenizer'
import { importUsfm } from '../../../scripts/import-bible/usfm'
import { importJps } from '../../../scripts/import-bible/jps'

describe('tokenizer v1', () => {
	for (const fixture of fixtures)
		it(fixture.name, () => {
			const tokens = tokenize(fixture.input)
			expect(tokens.map((token) => token.runs.map((run) => run.text).join(''))).toEqual(
				fixture.words,
			)
			expect(tokens.map((token) => token.i)).toEqual(fixture.words.map((_, index) => index))
			if (fixture.leading) expect(tokens.map((token) => token.leading)).toEqual(fixture.leading)
			if (fixture.trailing) expect(tokens.map((token) => token.trailing)).toEqual(fixture.trailing)
			expect(tokensToText(tokens)).toBe(fixture.input)
		})
	it('preserves supplied-word and partial-word italics without splitting the word', () => {
		expect(tokenize(supplied.runs)).toEqual([
			{
				i: 0,
				leading: '“',
				runs: [
					{ text: 'be', italic: false },
					{ text: 'hold', italic: true },
				],
				trailing: ',”',
				spaceAfter: ' ',
			},
			{ i: 1, leading: '', runs: [{ text: 'now', italic: false }], trailing: '', spaceAfter: '' },
		])
	})
	it('never carries token indices or italic state across verses; separates notes and titles', () => {
		const imported = importUsfm('PSA', sourceMarkup.usfm)
		expect(imported.verses.map((verse) => tokensToText(verse.tokens))).toEqual([
			'A word supplied here.',
			'Another word.',
		])
		expect(imported.verses[0]?.tokens[2]?.runs).toEqual([{ text: 'supplied', italic: true }])
		expect(imported.verses[1]?.tokens[0]).toMatchObject({
			i: 0,
			runs: [{ text: 'Another', italic: false }],
		})
		expect(imported.metadata.map((meta) => meta.kind)).toEqual([
			'id',
			'superscription',
			'footnote',
			's1',
		])
	})
	it('follows JPS source array numbering for psalm titles', () => {
		const book = importJps('PSA', {
			versionTitle: 'The Holy Scriptures: A New Translation (JPS 1917)',
			license: 'Public Domain',
			versionNotes: '',
			versionSource: '',
			text: [['A title.', 'A verse.']],
		})
		expect(book.verses.map((verse) => verse.ref.verse)).toEqual([1, 2])
	})
})

it('separates JPS small-print liturgical repetition from the verse', () => {
	const book = importJps('MAL', {
		versionTitle: 'The Holy Scriptures: A New Translation (JPS 1917)',
		license: 'Public Domain',
		versionNotes: '',
		versionSource: '',
		text: [['The verse.<br><small>[A repeated reading.]</small>']],
	})
	expect(tokensToText(book.verses[0]?.tokens ?? [])).toBe('The verse.')
	expect(book.metadata).toEqual([
		{ chapter: 1, verse: 1, kind: 'liturgical-repeat', text: '[A repeated reading.]' },
	])
})

it('retains all poetry and paragraph continuations in their source verse, excluding notes and headings', () => {
	const imported = importUsfm(
		'GEN',
		String.raw`\id GEN
\c 1
\v 27 God created mankind
\q2 in his image;
\q2 male and female he created them.\f + \fr 1:27 \ft A note.\f*
\s1 A heading
\v 28 God blessed them.
\p And said, “Be fruitful.”\x + \xo 1:28 \xt Genesis 9:1\x*`,
	)
	expect(imported.verses.map((verse) => tokensToText(verse.tokens))).toEqual([
		'God created mankind in his image; male and female he created them.',
		'God blessed them. And said, “Be fruitful.”',
	])
	expect(imported.metadata.map((entry) => entry.kind)).toEqual([
		'id',
		'footnote',
		's1',
		'cross-reference',
	])
})

it('keeps note-only verse labels as metadata without inventing verse text', () => {
	const imported = importUsfm(
		'ROM',
		String.raw`\c 16
\v 24 A verse.
\v 25 \f + \fr 16:25 \ft See Romans 14:24–26.\f*`,
	)
	expect(imported.verses.map((verse) => verse.ref.verse)).toEqual([24])
	expect(
		imported.metadata.some((entry) => entry.kind === 'empty-verse' && entry.verse === 25),
	).toBe(true)
})
