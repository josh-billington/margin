import { getStroke } from 'tldraw'
import type { InkPoint, InkStroke } from '@shared/study/types'
import type { Point } from '../bindings/terminals'

export const INK_SIZE = 3

export function mapStroke({
	points,
	map,
}: {
	points: InkStroke
	map: (point: InkPoint) => Point
}): InkStroke {
	const [first, ...rest] = points
	const transform = (point: InkPoint) => ({ ...map(point), z: point.z })
	return [transform(first), ...rest.map(transform)]
}

export function fitStroke({
	points,
	start,
	end,
}: {
	points: InkStroke
	start?: Point
	end?: Point
}) {
	const first = points[0]
	const last = points[points.length - 1] ?? first
	const from = start ?? first
	const to = end ?? last
	const dx = last.x - first.x
	const dy = last.y - first.y
	const lengthSquared = dx * dx + dy * dy
	const fit = Boolean(lengthSquared && (start || end))
	const along = fit ? ((to.x - from.x) * dx + (to.y - from.y) * dy) / lengthSquared : 1
	const across = fit ? ((to.y - from.y) * dx - (to.x - from.x) * dy) / lengthSquared : 0
	const anchor = lengthSquared ? from : (start ?? to)
	const apply = ({ x, y }: Point) => ({
		x: anchor.x + along * (x - first.x) - across * (y - first.y),
		y: anchor.y + across * (x - first.x) + along * (y - first.y),
	})
	const origin = apply({ x: 0, y: 0 })
	return {
		points: start || end ? mapStroke({ points, map: apply }) : points,
		scale: Math.hypot(along, across),
		apply,
		matrix: { a: along, b: across, c: -across, d: along, e: origin.x, f: origin.y },
	}
}

export function strokePath({ points, size = INK_SIZE }: { points: InkStroke; size?: number }) {
	if (size <= 0) return ''
	const outline = getStroke(points, { size, thinning: 0.65, simulatePressure: false, last: true })
	return outline.length ? `M${outline.map(({ x, y }) => `${x},${y}`).join('L')}Z` : ''
}

export function strokeApproach({
	points,
	terminal,
}: {
	points: InkStroke
	terminal: 'start' | 'end'
}) {
	const index = terminal === 'start' ? 0 : points.length - 1
	const step = terminal === 'start' ? 1 : -1
	const point = points[index] ?? points[0]
	for (let offset = index + step; offset >= 0 && offset < points.length; offset += step) {
		const sample = points[offset]
		if (!sample) continue
		const x = sample.x - point.x
		const y = sample.y - point.y
		if (Math.hypot(x, y) >= 8) return { x, y }
	}
	const other = (terminal === 'end' ? points[0] : points.at(-1)) ?? point
	return { x: other.x - point.x, y: other.y - point.y }
}
