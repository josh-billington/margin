import { describe, expect, it } from 'vitest'
import { compare, percentile } from './report'
import type { Interaction, Sample } from './report'

const interaction = (taskMs: number): Interaction => ({
	styleMs: taskMs / 2,
	layoutMs: 1,
	scriptMs: 1,
	taskMs,
	frameP95Ms: 17,
	framesOver33: 0,
})

const sample = (build: Sample['build'], round: number, zoomTaskMs: number): Sample => ({
	build,
	round,
	startupMs: 2000,
	zoom: interaction(zoomTaskMs),
	pan: interaction(300),
	typing: { ...interaction(1000), keyP95Ms: 40, keyMaxMs: 50, mainDelayP95Ms: 10 },
})

const zoomTask = (samples: Sample[]) =>
	compare(samples).find((row) => row.name === 'zoom: renderer task time')!

describe('perf comparison', () => {
	it('uses nearest-rank percentiles', () => {
		expect(percentile([5, 1, 4, 2, 3], 0.5)).toBe(3)
		expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10)
		expect(percentile([], 0.95)).toBe(0)
	})

	it('flags a slowdown that moves every head round', () => {
		const samples = [400, 410, 420].flatMap((ms, round) => [
			sample('base', round, ms),
			sample('head', round, ms * 2),
		])
		expect(zoomTask(samples).regressed).toBe(true)
	})

	it('ignores one slow head round', () => {
		const samples = [400, 410, 420].flatMap((ms, round) => [
			sample('base', round, ms),
			sample('head', round, round === 1 ? 2000 : ms),
		])
		expect(zoomTask(samples).regressed).toBe(false)
	})

	it('ignores a large ratio on a tiny absolute change', () => {
		const samples = [10, 11, 12].flatMap((ms, round) => [
			sample('base', round, ms),
			sample('head', round, ms * 3),
		])
		expect(zoomTask(samples).regressed).toBe(false)
	})

	it('reports head medians alone without a base', () => {
		const row = zoomTask([sample('head', 0, 400), sample('head', 1, 500), sample('head', 2, 450)])
		expect(row).toMatchObject({ head: 450, regressed: false })
		expect(row.base).toBeUndefined()
	})
})
