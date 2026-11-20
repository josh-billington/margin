import { describe, expect, it } from 'vitest'
import { LENS_RIM, LENS_SHIFT, lensField } from './lensField'

// The toolbar's size: a 406 × 38 capsule.
const field = lensField(406, 38, 19, 1)
/** Sample offset in CSS px at a pixel, as feDisplacementMap applies it with scale 2 × LENS_SHIFT. */
const offset = (x: number, y: number) => {
	const index = (y * field.columns + x) * 4
	const shift = (value: number) => 2 * LENS_SHIFT * (value / 255 - 0.5)
	return [shift(field.data[index]!), shift(field.data[index + 1]!)] as const
}

describe('lensField', () => {
	it('leaves the middle undistorted', () => {
		for (const [x, y] of [
			[203, 19],
			[100, 19],
			[300, LENS_RIM + 1],
		] as const) {
			const [dx, dy] = offset(x, y)
			expect(Math.abs(dx)).toBeLessThan(0.05)
			expect(Math.abs(dy)).toBeLessThan(0.05)
		}
	})

	it('pulls inward at the rim, most at the edge', () => {
		const [, top] = offset(203, 0)
		const [, bottom] = offset(203, 37)
		const [, nearTop] = offset(203, 4)
		expect(top).toBeGreaterThan(LENS_SHIFT * 0.8)
		expect(bottom).toBeLessThan(-LENS_SHIFT * 0.8)
		expect(nearTop).toBeGreaterThan(0)
		expect(nearTop).toBeLessThan(top)
		// The rounded ends bend toward the capsule's centre line, not straight down.
		const [endX] = offset(0, 19)
		expect(endX).toBeGreaterThan(LENS_SHIFT * 0.8)
	})

	it('is mirror-symmetric', () => {
		const [leftX, leftY] = offset(10, 5)
		const [rightX, rightY] = offset(field.columns - 11, field.rows - 6)
		expect(rightX).toBeCloseTo(-leftX, 1)
		expect(rightY).toBeCloseTo(-leftY, 1)
	})
})
