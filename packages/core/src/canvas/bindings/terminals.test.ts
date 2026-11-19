import { describe, expect, it } from 'vitest'
import {
	EMPTY_ABOVE_CAPS,
	HEAD_LENGTH,
	approach,
	arcMiddle,
	inkBox,
	outwardBend,
	wordTerminal,
} from './terminals'

const word = { x: 100, y: 100, w: 60, h: 20 } // centre (130, 110)

describe('word terminals', () => {
	it('sits gap above the word when the arrow comes from above', () => {
		expect(wordTerminal(word, { x: 0, y: -50 }, 5)).toEqual({ x: 130, y: 95 })
	})
	it('sits gap below the word when the arrow comes from below', () => {
		expect(wordTerminal(word, { x: 0, y: 80 }, 5)).toEqual({ x: 130, y: 125 })
	})
	it('follows the approach ray along the edge and clamps to the word ends', () => {
		expect(wordTerminal(word, { x: 15, y: -15 }, 5)).toEqual({ x: 145, y: 95 })
		expect(wordTerminal(word, { x: -500, y: -1 }, 5)).toEqual({ x: 100, y: 95 })
	})
	it('never lands on a side edge, even for a level approach', () => {
		expect(wordTerminal(word, { x: 300, y: 0 }, 5)).toEqual({ x: 160, y: 95 })
	})
})

describe('ink box', () => {
	it('drops the empty band above the capitals and keeps the descenders', () => {
		const ink = inkBox({ x: 0, y: 100, w: 40, h: 28 })
		expect(ink.y).toBeCloseTo(100 + 28 * EMPTY_ABOVE_CAPS)
		expect(ink.y + ink.h).toBe(128)
	})
	it('keeps a 14px head out of the letters of the line above (24px text, line-height 1.55)', () => {
		// The system font at 24px: a 28px line box, 37.2px line pitch, baseline ~5.8px above the box bottom.
		const word = { x: 0, y: 100, w: 40, h: 28 }
		const baselineAbove = word.y - (37.2 - 28) - 5.8
		const tip = wordTerminal(inkBox(word), { x: 0, y: -1 }, 5, HEAD_LENGTH)
		expect(tip.y - HEAD_LENGTH).toBeGreaterThan(baselineAbove)
		expect(tip.y).toBeLessThan(word.y + 28 * EMPTY_ABOVE_CAPS)
	})
})

describe('head clearance (any far end: note, free point or word)', () => {
	it('keeps the plain gap for a steep approach', () => {
		expect(wordTerminal(word, { x: 0, y: -50 }, 5, HEAD_LENGTH)).toEqual({ x: 130, y: 95 })
	})
	it('backs a level approach off so the lower wing clears the word', () => {
		const tip = wordTerminal(word, { x: 300, y: -1 }, 5, HEAD_LENGTH)
		expect(tip.x).toBe(160)
		// Wing reach towards the word is L·sin(30°) ≈ 7 for a level body.
		expect(word.y - tip.y).toBeGreaterThan(HEAD_LENGTH * Math.sin(Math.PI / 6))
		const below = wordTerminal(word, { x: -300, y: 1 }, 5, HEAD_LENGTH)
		expect(below.y - (word.y + word.h)).toBeGreaterThan(HEAD_LENGTH * Math.sin(Math.PI / 6))
	})
	it('is independent of the other end: same direction, same terminal', () => {
		const d = { x: 120, y: -40 }
		expect(wordTerminal(word, d, 5, HEAD_LENGTH)).toEqual(
			wordTerminal(word, { x: 240, y: -80 }, 5, HEAD_LENGTH),
		)
	})
})

describe('arc approach', () => {
	it('matches tldraw: positive bend bulges below a left-to-right chord', () => {
		expect(arcMiddle({ x: 0, y: 0 }, { x: 100, y: 0 }, 28)).toEqual({ x: 50, y: 28 })
	})
	it('reflects the chord across the middle to get the end tangent', () => {
		const start = { x: 0, y: 0 },
			end = { x: 100, y: 0 }
		const middle = arcMiddle(start, end, -50)! // semicircle bulging up
		const d = approach(end, start, middle)
		expect(d.x).toBeCloseTo(0)
		expect(d.y).toBeLessThan(0) // arrives straight down from above
	})
	it('uses the chord for straight arrows', () => {
		expect(approach({ x: 0, y: 0 }, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 })
	})
})

describe('outward bend', () => {
	it('bulges away from the block centre', () => {
		const centre = { x: 50, y: 100 }
		const bend = outwardBend({ x: 0, y: 10 }, { x: 100, y: 10 }, centre, 28)
		expect(arcMiddle({ x: 0, y: 10 }, { x: 100, y: 10 }, bend)!.y).toBeLessThan(10)
		const below = outwardBend({ x: 100, y: 190 }, { x: 0, y: 190 }, centre, 28)
		expect(arcMiddle({ x: 100, y: 190 }, { x: 0, y: 190 }, below)!.y).toBeGreaterThan(190)
	})
})
