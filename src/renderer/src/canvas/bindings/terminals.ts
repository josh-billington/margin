/**
 * Pure geometry for word-bound arrow terminals (page space). A terminal sits just outside its word,
 * on the top or bottom edge, so the arrowhead lands in the line gap instead of on the scripture.
 */
export interface Point {
	x: number
	y: number
}
export interface Box extends Point {
	w: number
	h: number
}

/** Page-unit gap between a word and the arrow tip at scale 1; the 2.5px round join adds ~1.25px. */
export const WORD_GAP = 5
/** SPEC §2.3: a filled triangular head ~14px long at 100%, 30° half-angle. */
export const HEAD_LENGTH = 14
const HEAD_HALF_ANGLE = Math.PI / 6
/** Extra clearance between the head's nearest wing and the word box. */
const WING_MARGIN = 2
/** tldraw's default bend; the sign is chosen at creation, the magnitude kept. */
export const DEFAULT_BEND = 28

/** tldraw's arc middle: chord midpoint pushed along `per(u)` by `-bend` (curved-arrow.mjs). */
export function arcMiddle(start: Point, end: Point, bend: number): Point | undefined {
	const dx = end.x - start.x,
		dy = end.y - start.y,
		length = Math.hypot(dx, dy)
	if (!length || !bend) return undefined
	const per = { x: dy / length, y: -dx / length }
	return { x: (start.x + end.x) / 2 - per.x * bend, y: (start.y + end.y) / 2 - per.y * bend }
}

/** Direction the arrow leaves `at` along its body: the chord, reflected across `at→middle` for arcs. */
export function approach(at: Point, other: Point, middle?: Point): Point {
	const a = { x: other.x - at.x, y: other.y - at.y }
	if (!middle) return a
	const m = { x: middle.x - at.x, y: middle.y - at.y },
		length = Math.hypot(m.x, m.y)
	if (!length) return a
	const ux = m.x / length,
		uy = m.y / length,
		d = a.x * ux + a.y * uy
	return { x: 2 * d * ux - a.x, y: 2 * d * uy - a.y }
}

/**
 * How far from the word's edge the tip must sit so the head's wings also clear the word. A steep
 * approach needs just `gap`; a level one swings a wing towards the word, so the tip backs off.
 */
export function clearance(direction: Point, above: boolean, gap: number, headLength: number) {
	const length = Math.hypot(direction.x, direction.y)
	if (!headLength || !length) return gap
	const toward = (above ? direction.y : -direction.y) / length
	const wing =
		headLength *
		(toward * Math.cos(HEAD_HALF_ANGLE) +
			Math.abs(direction.x / length) * Math.sin(HEAD_HALF_ANGLE))
	return Math.max(gap, wing + WING_MARGIN)
}

/**
 * Where the approach ray from the word's centre crosses the line `gap` above or below it (more for
 * a shallow approach, so the arrowhead's wings clear the word too). Side edges are never used: in
 * running text they sit against the neighbouring word. The result depends only on the word box and
 * the direction, never on what is bound at the arrow's other end.
 */
export function wordTerminal(box: Box, direction: Point, gap: number, headLength = 0): Point {
	const above = direction.y <= 0,
		out = clearance(direction, above, gap, headLength),
		reach = box.h / 2 + out,
		cx = box.x + box.w / 2,
		slope = direction.y ? direction.x / Math.abs(direction.y) : Math.sign(direction.x) * Infinity,
		dx = Math.max(-box.w / 2, Math.min(box.w / 2, slope * reach))
	return { x: cx + (Number.isFinite(dx) ? dx : 0), y: above ? box.y - out : box.y + box.h + out }
}

/** Bend sign that bulges the arc away from `centre` (towards the nearer block margin). */
export function outwardBend(start: Point, end: Point, centre: Point, magnitude: number) {
	const dx = end.x - start.x,
		dy = end.y - start.y
	const ox = (start.x + end.x) / 2 - centre.x,
		oy = (start.y + end.y) / 2 - centre.y || (ox ? 0 : -1)
	// middle - med = per(u) * -bend, per(u) = (dy, -dx)/|u|
	const side = dy * ox - dx * oy
	return side > 0 ? -magnitude : magnitude
}
