import { describe, expect, it } from 'vitest'
import { advance, axesOf, easeMotion, retarget, settled } from './cameraMotion'
import type { Motion } from './cameraMotion'

const run = (motion: Motion, ms: number, frame = 16) => {
	const frames: Motion[] = []
	for (let t = 0; t < ms; t += frame) frames.push((motion = advance(motion, frame)))
	return frames
}
const at = (motion: Motion) => axesOf(motion)[0]?.at ?? NaN
const velocity = (motion: Motion) => axesOf(motion)[0]?.velocity ?? NaN

describe('camera motion', () => {
	it('eases out to the target in 280ms, starting at full speed', () => {
		const frames = run(easeMotion([0], [100]), 280)
		expect(at(frames.at(-1)!)).toBe(100)
		expect(settled(frames.at(-1)!, 1)).toBe(true)
		expect(at(frames[0]!)).toBeGreaterThan(15)
	})

	it('reverses an interrupted move without a velocity cut', () => {
		// Zooming in (0 → 100), interrupted at 100ms and sent back to 0.
		const zooming = run(easeMotion([0], [100]), 100).at(-1)!
		const before = velocity(zooming)
		expect(before).toBeGreaterThan(0)
		const back = retarget(zooming, [0])
		expect(velocity(back)).toBe(before)
		const frames = run(back, 1000)
		// The first frame still moves forward a little, slower: it decelerates, then turns.
		expect(at(frames[0]!)).toBeGreaterThan(at(zooming))
		expect(velocity(frames[0]!)).toBeLessThan(before)
		// Restarting an ease-out back to 0 (the old behaviour) jumps from +v to full speed backwards
		// in one frame. The spring's largest change in one frame is under half of that.
		const hardCut = before + (3 * at(zooming)) / 0.28
		let last = before
		for (const frame of frames.slice(0, 20)) {
			expect(Math.abs(velocity(frame) - last)).toBeLessThan(hardCut / 2)
			last = velocity(frame)
		}
		// Settles at the new target without overshoot past it.
		const settledAt = frames.findIndex((frame) => settled(frame, 1))
		expect(settledAt).toBeGreaterThan(0)
		expect(settledAt * 16).toBeLessThan(800)
		expect(Math.min(...frames.map(at))).toBeGreaterThan(-0.25)
	})
})
