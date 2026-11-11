import { describe, expect, it } from 'vitest'
import { ulid } from 'ulid'
import { amosFixture, psalmFixture } from '../fixtures/passages'
import { replaceRange, words, wordIndex } from './ranges'
import type { Highlight, PaletteColor } from '@shared/study/types'

const all = words(amosFixture)
function at(i: number) {
	const word = all[i - 1]
	if (!word) throw new Error('Missing fixture word')
	return word
}
const place = ulid(),
	person = ulid()
const range = (start: number, end: number, tagId = place): Highlight => ({
	id: ulid(),
	tagId,
	start: at(start),
	end: at(end),
})
const summary = (ranges: Highlight[]) =>
	ranges.map((h) => [
		wordIndex(amosFixture, h.start) + 1,
		wordIndex(amosFixture, h.end) + 1,
		h.tagId ?? h.color,
	])
const plain = (start: number, end: number, color: PaletteColor): Highlight => ({
	id: ulid(),
	color,
	start: at(start),
	end: at(end),
})
describe('whole-word highlight replacement', () => {
	it('SPEC §4.4: Place 1–8, Person 3–5 preserves both Place fragments', () => {
		const result = replaceRange(amosFixture, [range(1, 8)], at(3), at(5), { tagId: person })
		expect(summary(result)).toEqual([
			[1, 2, place],
			[3, 5, person],
			[6, 8, place],
		])
		expect(new Set(result.map((h) => h.id)).size).toBe(3)
	})
	it('merges adjacent same-tag ranges in either drag direction', () => {
		expect(
			summary(
				replaceRange(amosFixture, [range(1, 2), range(6, 8)], at(5), at(3), { tagId: place }),
			),
		).toEqual([[1, 8, place]])
	})
	it('replaces only intersections across multiple ranges and keeps distant ranges', () => {
		expect(
			summary(
				replaceRange(amosFixture, [range(1, 4), range(6, 9), range(12, 14)], at(3), at(7), {
					tagId: person,
				}),
			),
		).toEqual([
			[1, 2, place],
			[3, 7, person],
			[8, 9, place],
			[12, 14, place],
		])
	})
	it('removes a subrange without overlap', () => {
		expect(summary(replaceRange(amosFixture, [range(1, 8)], at(3), at(5), null))).toEqual([
			[1, 2, place],
			[6, 8, place],
		])
	})
	it('uses full verse identity and spans verse boundaries', () => {
		const end = amosFixture.verses[1]?.tokens[1]
		const ref = amosFixture.verses[1]?.ref
		if (!end || !ref) throw new Error('Fixture missing verse')
		const result = replaceRange(
			amosFixture,
			[],
			at(4),
			{ verse: ref, token: end.i },
			{ tagId: place },
		)
		expect(result[0]?.end).toEqual({ verse: ref, token: 1 })
		expect(() =>
			replaceRange(
				amosFixture,
				[],
				{ verse: { book: 'PSA', chapter: 119, verse: 1 }, token: 0 },
				at(2),
				{ tagId: place },
			),
		).toThrow()
		expect(words(psalmFixture).length).toBeGreaterThan(180)
	})
	describe('plain highlights', () => {
		it('merges adjacent same-colour ranges but not different colours or tags', () => {
			expect(
				summary(
					replaceRange(amosFixture, [plain(1, 2, 'amber')], at(3), at(4), { color: 'amber' }),
				),
			).toEqual([[1, 4, 'amber']])
			expect(
				summary(replaceRange(amosFixture, [plain(1, 2, 'amber')], at(3), at(4), { color: 'sky' })),
			).toEqual([
				[1, 2, 'amber'],
				[3, 4, 'sky'],
			])
			expect(
				summary(replaceRange(amosFixture, [range(1, 2)], at(3), at(4), { color: 'amber' })),
			).toEqual([
				[1, 2, place],
				[3, 4, 'amber'],
			])
		})
		it('recolours inside a range, keeping prefix and suffix', () => {
			expect(
				summary(replaceRange(amosFixture, [plain(1, 8, 'amber')], at(3), at(5), { color: 'rose' })),
			).toEqual([
				[1, 2, 'amber'],
				[3, 5, 'rose'],
				[6, 8, 'amber'],
			])
		})
		it('converts a plain highlight to a tag and back', () => {
			const tagged = replaceRange(amosFixture, [plain(1, 4, 'amber')], at(1), at(4), {
				tagId: place,
			})
			expect(tagged[0]?.color).toBeUndefined()
			expect(tagged[0]?.tagId).toBe(place)
			const back = replaceRange(amosFixture, tagged, at(1), at(4), { color: 'green' })
			expect(back[0]?.tagId).toBeUndefined()
			expect(back[0]?.color).toBe('green')
		})
	})
})
