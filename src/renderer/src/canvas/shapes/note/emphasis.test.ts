import { describe, expect, it } from 'vitest'
import { parseEmphasis, stripEmphasis } from './emphasis'

describe('note emphasis', () => {
	it('marks *emphasis* runs and keeps surrounding text', () => {
		expect(parseEmphasis('see *this* now')).toEqual([
			{ text: 'see ', emphasis: false },
			{ text: 'this', emphasis: true },
			{ text: ' now', emphasis: false },
		])
	})
	it('leaves lone or empty asterisks literal', () => {
		expect(stripEmphasis('a * b ** c')).toBe('a * b ** c')
		expect(parseEmphasis('')).toEqual([])
	})
})
