import { describe, expect, it } from 'vitest'
import { computeBrightSet } from './dimming'
import type { DimModel } from './dimming'

const v = (verse: number) => ({ book: 'AMO' as const, chapter: 1, verse })
const model: DimModel = {
	notes: [
		{ id: 'n-assoc', association: { passageId: 'p1' } },
		{ id: 'n-v3', association: { passageId: 'p1', verse: v(3) } },
		{ id: 'n-v4', association: { passageId: 'p1', verse: v(4) } },
		{ id: 'n-arrow3' },
		{ id: 'n-arrow4' },
		{ id: 'n-far' },
		{ id: 'n-other', association: { passageId: 'p2' } },
	],
	arrows: [
		{ id: 'a3', ends: [{ toId: 'n-arrow3' }, { toId: 'p1', verse: v(3) }] },
		{ id: 'a4', ends: [{ toId: 'n-arrow4' }, { toId: 'p1', verse: v(4) }] },
		{ id: 'chain', ends: [{ toId: 'n-arrow3' }, { toId: 'n-far' }] },
		{ id: 'p2arrow', ends: [{ toId: 'p2', verse: v(1) }, { toId: 'n-other' }] },
		{
			id: 'crossPassage',
			ends: [
				{ toId: 'p1', verse: v(3) },
				{ toId: 'p2', verse: v(2) },
			],
		},
	],
}

describe('focus brightness', () => {
	it('passage focus keeps connected and associated notes with their arrows', () => {
		const bright = computeBrightSet(model, { level: 'passage', passageId: 'p1' })
		for (const id of ['p1', 'n-assoc', 'n-v3', 'n-v4', 'n-arrow3', 'n-arrow4', 'a3', 'a4'])
			expect(bright.has(id), id).toBe(true)
		for (const id of ['n-other', 'p2arrow']) expect(bright.has(id), id).toBe(false)
	})
	it('does not propagate through arrows to other notes or passages', () => {
		const bright = computeBrightSet(model, { level: 'passage', passageId: 'p1' })
		expect(bright.has('n-far')).toBe(false)
		expect(bright.has('p2')).toBe(false)
		// The arrow directly meets focused content; its far passage stays dim.
		expect(bright.has('crossPassage')).toBe(true)
		// An arrow between a bright note and a dim note is the bright note's direct arrow.
		expect(bright.has('chain')).toBe(true)
	})
	it('verse focus keeps that verse, its notes, and whole-passage notes', () => {
		const bright = computeBrightSet(model, { level: 'verse', passageId: 'p1', verse: v(3) })
		for (const id of ['p1', 'n-assoc', 'n-v3', 'n-arrow3', 'a3'])
			expect(bright.has(id), id).toBe(true)
		for (const id of ['n-v4', 'n-arrow4', 'a4']) expect(bright.has(id), id).toBe(false)
	})
	it('keeps nothing else bright with no annotations', () => {
		expect([
			...computeBrightSet({ notes: [], arrows: [] }, { level: 'passage', passageId: 'x' }),
		]).toEqual(['x'])
	})
})
