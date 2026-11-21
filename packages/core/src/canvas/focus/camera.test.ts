import { describe, expect, it } from 'vitest'
import {
	centerOn,
	effectiveScripturePx,
	estimateVerseBounds,
	fitCamera,
	minReadableZoom,
	planFocusCamera,
	zoomAt,
} from './camera'

const viewport = { w: 1200, h: 800 }
const toScreen = (camera: { x: number; y: number; z: number }, p: { x: number; y: number }) => ({
	x: (p.x + camera.x) * camera.z,
	y: (p.y + camera.y) * camera.z,
})

describe('focus camera', () => {
	it('computes the readable zoom floor from font scale', () => {
		expect(effectiveScripturePx(1, minReadableZoom(1))).toBeCloseTo(22)
		expect(effectiveScripturePx(1.4, minReadableZoom(1.4))).toBeCloseTo(22)
	})
	it('fits a short passage with margin', () => {
		const bounds = { x: 100, y: 100, w: 720, h: 300 }
		const plan = planFocusCamera({ viewport, bounds, fontScale: 1, anchor: null })
		expect(plan.fitted).toBe(true)
		const topLeft = toScreen(plan.camera, bounds),
			bottomRight = toScreen(plan.camera, { x: bounds.x + bounds.w, y: bounds.y + bounds.h })
		expect(topLeft.x).toBeGreaterThanOrEqual(47.9)
		expect(topLeft.y).toBeGreaterThanOrEqual(47.9)
		expect(bottomRight.x).toBeLessThanOrEqual(1200 - 47.9)
		expect(bottomRight.y).toBeLessThanOrEqual(800 - 47.9)
	})
	it('never drops below 22px; long chapters align the start', () => {
		const bounds = { x: 0, y: 0, w: 720, h: 12000 }
		const plan = planFocusCamera({ viewport, bounds, fontScale: 1, anchor: null })
		expect(plan.fitted).toBe(false)
		expect(effectiveScripturePx(1, plan.camera.z)).toBeGreaterThanOrEqual(22 - 1e-9)
		expect(toScreen(plan.camera, { x: 0, y: 0 }).y).toBeCloseTo(48)
	})
	it('centers the active verse when the block is too tall', () => {
		const bounds = { x: 0, y: 0, w: 720, h: 12000 }
		const plan = planFocusCamera({ viewport, bounds, fontScale: 1, anchor: { x: 360, y: 6000 } })
		const screen = toScreen(plan.camera, { x: 360, y: 6000 })
		expect(screen.x).toBeCloseTo(600)
		expect(screen.y).toBeCloseTo(400)
	})
	it('respects the zoom limits', () => {
		const tiny = fitCamera(viewport, { x: 0, y: 0, w: 1, h: 1 })
		expect(tiny.z).toBe(4)
		const huge = fitCamera(viewport, { x: 0, y: 0, w: 1e7, h: 1e7 })
		expect(huge.z).toBe(0.1)
	})
	it('centers a point', () => {
		const screen = toScreen(centerOn(viewport, { x: 50, y: 70 }, 2), { x: 50, y: 70 })
		expect(screen.x).toBeCloseTo(600)
		expect(screen.y).toBeCloseTo(400)
	})
	it('estimates verse bounds proportionally', () => {
		const verse = estimateVerseBounds({ x: 0, y: 100, w: 500, h: 400 }, [10, 30, 10], 1)
		expect(verse.y).toBeCloseTo(180)
		expect(verse.h).toBeCloseTo(240)
	})
	it('zooms about the pointer', () => {
		const camera = { x: 10, y: 20, z: 1 }
		const next = zoomAt(camera, { x: 300, y: 200 }, 2)
		const screen = toScreen(next, { x: 300 - 10, y: 200 - 20 })
		expect(screen.x).toBeCloseTo(300)
		expect(screen.y).toBeCloseTo(200)
		expect(zoomAt(camera, { x: 0, y: 0 }, 99).z).toBe(4)
	})
})
