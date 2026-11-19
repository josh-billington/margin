/** Pure camera math for focus mode (SPEC §5.1). tldraw convention: screen = (page + camera) * z. */
export interface Box {
	x: number
	y: number
	w: number
	h: number
}
export interface Viewport {
	w: number
	h: number
}
export interface Camera {
	x: number
	y: number
	z: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4
/** Scripture is 28px at font scale 1 (matches PassageComponent). */
export const BASE_SCRIPTURE_PX = 28
export const MIN_READABLE_PX = 22
export const FOCUS_MARGIN = 48
export const CAMERA_MS = 280

export const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))
export const effectiveScripturePx = (fontScale: number, zoom: number) =>
	BASE_SCRIPTURE_PX * fontScale * zoom
/** Smallest zoom at which scripture of this scale stays at least 22 screen pixels. */
export const minReadableZoom = (fontScale: number) =>
	clamp(MIN_READABLE_PX / (BASE_SCRIPTURE_PX * fontScale), MIN_ZOOM, MAX_ZOOM)

/** Camera that shows `point` at the viewport center. */
export const centerOn = (
	viewport: Viewport,
	point: { x: number; y: number },
	z: number,
): Camera => ({
	x: viewport.w / (2 * z) - point.x,
	y: viewport.h / (2 * z) - point.y,
	z,
})

/** Zoom that fits `bounds` inside the viewport minus a margin on every side. */
export function fitZoom(viewport: Viewport, bounds: Box, margin: number) {
	const availableW = Math.max(1, viewport.w - 2 * margin),
		availableH = Math.max(1, viewport.h - 2 * margin)
	return Math.min(availableW / Math.max(1, bounds.w), availableH / Math.max(1, bounds.h))
}

export function fitCamera(
	viewport: Viewport,
	bounds: Box,
	margin = FOCUS_MARGIN,
	maxZoom = MAX_ZOOM,
): Camera {
	const z = clamp(fitZoom(viewport, bounds, margin), MIN_ZOOM, maxZoom)
	return centerOn(viewport, { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }, z)
}

export interface FocusCameraInput {
	viewport: Viewport
	/** The block (or verse) to show. Connected notes are never included. */
	bounds: Box
	fontScale: number
	/** Page point to center when the bounds cannot fit; null aligns the block start to the top. */
	anchor: { x: number; y: number } | null
	margin?: number
	maxZoom?: number
}
export interface FocusCameraPlan {
	camera: Camera
	/** True when the whole bounds fit with margin at a readable size. */
	fitted: boolean
}

/**
 * Fits the bounds with a margin only if scripture stays >= 22 screen px. Otherwise zooms to
 * the readable minimum and centers the active verse, or aligns the start of the block.
 */
export function planFocusCamera(input: FocusCameraInput): FocusCameraPlan {
	const { viewport, bounds, fontScale, anchor } = input
	const margin = input.margin ?? FOCUS_MARGIN,
		maxZoom = input.maxZoom ?? MAX_ZOOM
	const readable = minReadableZoom(fontScale)
	const fit = fitZoom(viewport, bounds, margin)
	if (fit >= readable) return { camera: fitCamera(viewport, bounds, margin, maxZoom), fitted: true }
	const z = clamp(readable, MIN_ZOOM, maxZoom)
	const centerX = bounds.x + bounds.w / 2
	if (anchor) return { camera: centerOn(viewport, { x: centerX, y: anchor.y }, z), fitted: false }
	return {
		camera: {
			x: viewport.w / (2 * z) - centerX,
			y: margin / z - bounds.y,
			z,
		},
		fitted: false,
	}
}

/** Where a verse sits inside a block when its DOM is not mounted: proportional to text length. */
export function estimateVerseBounds(block: Box, weights: readonly number[], index: number): Box {
	const total = weights.reduce((sum, weight) => sum + Math.max(1, weight), 0) || 1
	const before = weights.slice(0, index).reduce((sum, weight) => sum + Math.max(1, weight), 0)
	const own = Math.max(1, weights[index] ?? 1)
	return {
		x: block.x,
		y: block.y + (block.h * before) / total,
		w: block.w,
		h: Math.max(1, (block.h * own) / total),
	}
}

/** Zoom after a wheel/pinch step, centered on a screen point (keeps the page point fixed). */
export function zoomAt(camera: Camera, pointer: { x: number; y: number }, nextZ: number): Camera {
	const z = clamp(nextZ, MIN_ZOOM, MAX_ZOOM)
	const page = { x: pointer.x / camera.z - camera.x, y: pointer.y / camera.z - camera.y }
	return { x: pointer.x / z - page.x, y: pointer.y / z - page.y, z }
}

export const prefersReducedMotion = () =>
	typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
