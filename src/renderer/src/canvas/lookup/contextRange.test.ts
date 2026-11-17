import { expect, it } from 'vitest'
import { amosFixture } from '../fixtures/passages'
import { words } from '../highlights/ranges'
import { contextLookupRequest } from './contextRange'

const all = words(amosFixture)
const word = (i: number) => {
	const target = all[i]
	if (!target) throw new Error('Missing fixture word')
	return target
}
const point = { x: 10, y: 20 }

it('looks up the clicked word, not the tag around it, when nothing is selected', () => {
	expect(contextLookupRequest(amosFixture, 'p', null, word(6), point)).toEqual({
		passageId: 'p',
		start: word(6),
		end: word(6),
		...point,
	})
})

it('looks up the live selection when it contains the clicked word', () => {
	const selection = { passageId: 'p', start: word(5), end: word(8), x: 0, y: 0 }
	expect(contextLookupRequest(amosFixture, 'p', selection, word(6), point)).toBe(selection)
	const reversed = { ...selection, start: word(8), end: word(5) }
	expect(contextLookupRequest(amosFixture, 'p', reversed, word(8), point)).toBe(reversed)
})

it('ignores a selection elsewhere', () => {
	const selection = { passageId: 'p', start: word(1), end: word(3), x: 0, y: 0 }
	expect(contextLookupRequest(amosFixture, 'p', selection, word(6), point).start).toEqual(word(6))
	const other = { ...selection, passageId: 'q', start: word(5), end: word(8) }
	expect(contextLookupRequest(amosFixture, 'p', other, word(6), point).end).toEqual(word(6))
})
