import { describe, expect, it } from 'vitest'
import { ENTER_SPRING, springAt, springEasing } from './popoverMotion'

describe('popover enter spring', () => {
	const curve = springEasing()
	const points = curve.easing.slice('linear('.length, -1).split(', ').map(Number)

	it('starts at rest and lands exactly on the target', () => {
		expect(points[0]).toBe(0)
		expect(points.at(-1)).toBe(1)
	})

	it('overshoots by at most 2% of its travel', () => {
		expect(curve.overshoot).toBeGreaterThan(0)
		expect(curve.overshoot).toBeLessThanOrEqual(0.02)
	})

	it('is within 1% of the target from about 250 ms on', () => {
		const settled = (band: number) => {
			for (let ms = 1000; ms > 0; ms--)
				if (Math.abs(1 - springAt(ms / 1000, ENTER_SPRING)) > band) return ms + 1
			return 0
		}
		expect(settled(0.01)).toBeGreaterThan(200)
		expect(settled(0.01)).toBeLessThan(300)
		// The easing runs on until the spring is within 0.1%, far below a pixel, so it ends unseen.
		expect(curve.durationMs).toBe(settled(0.001))
	})

	it('samples often enough that no step is visible', () => {
		expect(curve.durationMs / (points.length - 1)).toBeLessThanOrEqual(8)
	})
})
