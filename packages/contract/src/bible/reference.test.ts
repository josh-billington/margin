import { describe, expect, it } from 'vitest'
import { findBooks } from './books'
import { looksLikeReference, parseReference } from './reference'

describe('reference syntax and aliases', () => {
	it.each(['Amos', 'Am', 'AMO'])('resolves %s exactly', (alias) =>
		expect(findBooks(alias).map((book) => book.id)).toEqual(['AMO']),
	)
	it.each(['1 Sam', '1Sa', 'I Samuel', 'i. samuel'])('resolves %s', (alias) =>
		expect(findBooks(alias).map((book) => book.id)).toEqual(['1SA']),
	)
	it.each(['Ps', 'Psalm', 'Psalms'])('resolves %s', (alias) =>
		expect(findBooks(alias).map((book) => book.id)).toEqual(['PSA']),
	)
	it.each(['Song of Songs', 'Song of Solomon', 'Canticles'])('resolves %s', (alias) =>
		expect(findBooks(alias).map((book) => book.id)).toEqual(['SNG']),
	)
	it('does not guess partial names', () => expect(findBooks('Jo')).toEqual([]))
	it.each([
		'Amos 1:5-3',
		'Amos 1-2',
		'Amos 1:3-Romans 2:1',
		'Amos 0',
		'Amos 1:99',
		'Amos 1:3-2:99',
	])('rejects %s', (reference) => {
		expect(
			parseReference(reference, 'kjv', (_translation, _book, chapter) =>
				chapter === 1 || chapter === 2 ? [1, 2, 3, 4, 5] : [],
			).kind,
		).toBe('error')
	})
})

describe('Old Testament default translation', () => {
	const verses = () => [1, 2, 3, 4, 5]
	const translationOf = (reference: string, ot?: 'kjv' | 'jps1917') => {
		const parsed = parseReference(reference, 'kjv', verses, ot)
		return parsed.kind === 'resolved' ? parsed.translation : parsed.kind
	}
	it('applies to unqualified OT books only', () => {
		expect(translationOf('Amos 1:3', 'jps1917')).toBe('jps1917')
		expect(translationOf('Romans 1:3', 'jps1917')).toBe('kjv')
		expect(translationOf('Amos 1:3')).toBe('kjv')
	})
	it('lets an explicit qualifier win', () => {
		expect(translationOf('KJV Amos 1:3', 'jps1917')).toBe('kjv')
	})
})

describe('translation precedence', () => {
	const verses = () => [1, 2, 3, 4, 5]
	const translationOf = (reference: string, dialog: 'kjv' | 'jps1917', ot?: 'kjv' | 'jps1917') => {
		const parsed = parseReference(reference, dialog, verses, ot)
		return parsed.kind === 'resolved' ? parsed.translation : parsed.kind
	}
	it('qualifier beats the Old Testament default', () => {
		expect(translationOf('JPS Amos 1:3', 'kjv', 'kjv')).toBe('jps1917')
		expect(translationOf('KJV Amos 1:3', 'jps1917', 'jps1917')).toBe('kjv')
	})
	it('an explicit dialog choice (no OT default passed) beats the stored default', () => {
		expect(translationOf('Psalm 23', 'jps1917')).toBe('jps1917')
	})
	it('the OT default only applies when the caller passes it', () => {
		expect(translationOf('Psalm 23', 'jps1917', 'kjv')).toBe('kjv')
	})
})

it.each(['BSB', 'WEB', 'ASV'])('resolves the %s qualifier ahead of the stored OT default', (id) => {
	const parsed = parseReference(`${id.toLowerCase()} Genesis 1:1`, 'kjv', () => [1], 'jps1917')
	expect(parsed).toMatchObject({ kind: 'resolved', translation: id.toLowerCase(), notice: null })
})

describe('reference labels', () => {
	const verses = () => [1, 2, 3, 4, 5, 6]
	it('names a single psalm in the singular and several in the plural', () => {
		expect(parseReference('Psalms 23', 'kjv', verses)).toMatchObject({ label: 'Psalm 23:1–6' })
		expect(parseReference('Ps 23:1-24:6', 'kjv', verses)).toMatchObject({
			label: 'Psalms 23:1–24:6',
		})
	})
	it.each(['John 3', 'KJV Amos 1:3–', '1 John 3:16', 'Psalm 23'])(
		'reads %s as a reference',
		(input) => expect(looksLikeReference(input)).toBe(true),
	)
	it.each(['tender mercies', 'John', 'Job 1 satan', '"valley of the shadow"', '666'])(
		'reads %s as a search',
		(input) => expect(looksLikeReference(input)).toBe(false),
	)
})
