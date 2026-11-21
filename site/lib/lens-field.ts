// Copied from packages/core/src/app/lensField.ts (the app's glass toolbar). Keep the two in step.

/** Bend only within this band inside the edge (CSS px); everything further in is undistorted. */
export const LENS_RIM = 10
/** The most a pixel at the very edge is displaced, inward along the edge normal (CSS px). */
export const LENS_SHIFT = 9

/**
 * The displacement map for a rounded rectangle, as RGBA pixels: red and green carry the x and y
 * sample offset (128 is none), scaled by the filter's `scale` of 2 × LENS_SHIFT. Offsets point
 * inward along the edge normal and fall off over LENS_RIM, so the rim pulls the canvas in like a
 * glass edge while the middle samples straight through.
 */
export function lensField(width: number, height: number, radius: number, scale: number) {
	const columns = Math.max(1, Math.round(width * scale))
	const rows = Math.max(1, Math.round(height * scale))
	const data = new Uint8ClampedArray(columns * rows * 4)
	const halfWidth = width / 2
	const halfHeight = height / 2
	const corner = Math.min(radius, halfWidth, halfHeight)
	const band = Math.min(LENS_RIM, corner || LENS_RIM)
	for (let row = 0; row < rows; row++) {
		const y = (row + 0.5) / scale - halfHeight
		for (let column = 0; column < columns; column++) {
			const x = (column + 0.5) / scale - halfWidth
			const qx = Math.abs(x) - (halfWidth - corner)
			const qy = Math.abs(y) - (halfHeight - corner)
			// Depth inside the edge, and the outward normal there.
			let depth: number
			let nx = 0
			let ny = 0
			if (qx > 0 && qy > 0) {
				const length = Math.hypot(qx, qy)
				depth = corner - length
				nx = (qx / length) * Math.sign(x)
				ny = (qy / length) * Math.sign(y)
			} else if (qx > qy) {
				depth = halfWidth - Math.abs(x)
				nx = Math.sign(x)
			} else {
				depth = halfHeight - Math.abs(y)
				ny = Math.sign(y)
			}
			const t = depth >= 0 && depth < band ? 1 - depth / band : 0
			// Steepest at the edge, flat (zero slope) where the band meets the undistorted middle.
			const offset = 0.5 * t * t
			const index = (row * columns + column) * 4
			data[index] = Math.round((0.5 - nx * offset) * 255)
			data[index + 1] = Math.round((0.5 - ny * offset) * 255)
			data[index + 2] = 128
			data[index + 3] = 255
		}
	}
	return { columns, rows, data }
}
