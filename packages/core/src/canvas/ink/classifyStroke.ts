import type { TLShapeId } from 'tldraw'
import type { InkStroke, WordTarget } from '@shared/study/types'
import { wordKey } from '../highlights/ranges'

const CLOSE_ENDPOINTS_PX = 6
const CLOSE_ENDPOINTS_RATIO = 0.2

export type StrokeTarget = { shape: { id: TLShapeId } } & (
	{ kind: 'word'; word: WordTarget } | { kind: 'block' } | { kind: 'note' }
)

type StrokeIntent<Target extends StrokeTarget> =
	| { kind: 'handwriting'; noteId: TLShapeId }
	| { kind: 'arrow'; start: Target; end: Target }
	| { kind: 'ink' }

function sameTarget({ start, end }: { start: StrokeTarget; end: StrokeTarget }) {
	if (start.shape.id !== end.shape.id || start.kind !== end.kind) return false
	if (start.kind === 'word' && end.kind === 'word') return wordKey(start.word) === wordKey(end.word)
	return true
}

export function classifyStroke<Target extends StrokeTarget>({
	points,
	start,
	end,
	staysInStartNote,
	zoom,
}: {
	points: InkStroke
	start: Target | undefined
	end: Target | undefined
	staysInStartNote: boolean
	zoom: number
}): StrokeIntent<Target> {
	if (!start || !end) return { kind: 'ink' }
	if (sameTarget({ start, end })) {
		return start.kind === 'note' && staysInStartNote
			? { kind: 'handwriting', noteId: start.shape.id }
			: { kind: 'ink' }
	}
	let length = 0
	let previous = points[0]
	for (const point of points) {
		length += Math.hypot(point.x - previous.x, point.y - previous.y)
		previous = point
	}
	const chord = Math.hypot(previous.x - points[0].x, previous.y - points[0].y)
	return chord * zoom <= CLOSE_ENDPOINTS_PX || chord <= length * CLOSE_ENDPOINTS_RATIO
		? { kind: 'ink' }
		: { kind: 'arrow', start, end }
}
