import { describe, expect, it } from 'vitest'
import type { PassageProps } from '@shared/study/types'
import { amosFixture } from '../fixtures/passages'
import { highlightsForVerse, pulledOutProps } from './pullOut'
import { orderPassages } from './passageOrder'

const ulid = (n: number) => `01ARZ3NDEKTSV4RRFFQ69G5F${String(n).padStart(2, '0')}`
const source = (): PassageProps => {
	const verses = amosFixture.verses
	const [v1, v2, v3] = verses
	if (!v1 || !v2 || !v3) throw new Error('fixture needs three verses')
	const t = 'A'.repeat(26)
	return {
		width: 720,
		text: amosFixture,
		layout: 'flow',
		showVerseNumbers: true,
		showSuppliedWordItalics: true,
		fontScale: 1,
		highlights: [
			{
				id: ulid(1),
				tagId: t,
				start: { verse: v1.ref, token: 0 },
				end: { verse: v2.ref, token: 1 },
			},
			{
				id: ulid(2),
				tagId: t,
				start: { verse: v3.ref, token: 0 },
				end: { verse: v3.ref, token: 1 },
			},
		],
	}
}

describe('pull out verse', () => {
	it('copies one verse at 1.4x scale and records its source', () => {
		const props = source()
		const verse = props.text.verses[1]!.ref
		const out = pulledOutProps(props, 'shape:a', verse, () => 'NEW')!
		expect(out.text.verses).toHaveLength(1)
		expect(out.text.verses[0]!.ref).toEqual(verse)
		expect(out.fontScale).toBeCloseTo(1.4)
		expect(out.pulledFrom).toEqual({ passageId: 'shape:a', verse })
	})
	it('clips intersecting highlights with fresh IDs and skips the rest', () => {
		const props = source()
		const verse = props.text.verses[1]!.ref
		const copies = highlightsForVerse(props, verse, () => 'FRESH')
		expect(copies).toHaveLength(1)
		expect(copies[0]!.id).toBe('FRESH')
		expect(copies[0]!.start).toEqual({ verse, token: props.text.verses[1]!.tokens[0]!.i })
		expect(copies[0]!.end.token).toBe(1)
		expect(copies[0]!.tagId).toBe(props.highlights[0]!.tagId)
		expect(props.highlights[0]!.id).toBe(ulid(1))
	})
	it('returns null for an absent verse', () => {
		expect(pulledOutProps(source(), 'x', { book: 'AMO', chapter: 9, verse: 9 })).toBeNull()
	})
})

describe('scripture order', () => {
	it('orders by canon, chapter and verse rather than canvas position', () => {
		const ordered = orderPassages([
			{ id: 'rom', first: { book: 'ROM', chapter: 8, verse: 1 }, x: 0, y: 0 },
			{ id: 'amos5', first: { book: 'AMO', chapter: 5, verse: 1 }, x: 10, y: 10 },
			{ id: 'amos1', first: { book: 'AMO', chapter: 1, verse: 3 }, x: 900, y: 900 },
			{ id: 'amos1b', first: { book: 'AMO', chapter: 1, verse: 3 }, x: 0, y: 5 },
		])
		expect(ordered.map((p) => p.id)).toEqual(['amos1b', 'amos1', 'amos5', 'rom'])
	})
})
