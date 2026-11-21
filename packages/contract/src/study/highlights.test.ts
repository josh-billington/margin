import { describe, expect, it } from 'vitest'
import { ulid } from 'ulid'
import { countHighlightRanges, referencedTagIds } from './tags'
import { highlightSchema } from './types'

const word = { verse: { book: 'AMO' as const, chapter: 1, verse: 1 }, token: 0 }
const base = () => ({ id: ulid(), start: word, end: word })

describe('highlight schema', () => {
	it('accepts an existing tagged record unchanged', () => {
		const old = { ...base(), tagId: ulid() }
		expect(highlightSchema.parse(old)).toEqual(old)
	})
	it('accepts a plain highlight with a palette colour', () => {
		expect(highlightSchema.safeParse({ ...base(), color: 'amber' }).success).toBe(true)
	})
	it('rejects both tagId and color, or neither', () => {
		expect(highlightSchema.safeParse({ ...base(), tagId: ulid(), color: 'sky' }).success).toBe(
			false,
		)
		expect(highlightSchema.safeParse(base()).success).toBe(false)
	})
	it('rejects a colour outside the palette', () => {
		expect(highlightSchema.safeParse({ ...base(), color: 'magenta' }).success).toBe(false)
	})
})

describe('tag bookkeeping ignores plain highlights', () => {
	const tag = ulid()
	const lists = [
		[
			{ ...base(), tagId: tag },
			{ ...base(), color: 'amber' as const },
		],
		[{ ...base(), tagId: tag }],
	]
	it('counts only tagged ranges', () => {
		expect(countHighlightRanges(lists)).toEqual({ [tag]: 2 })
	})
	it('references only tag IDs', () => {
		expect(referencedTagIds(lists)).toEqual([tag])
	})
})
