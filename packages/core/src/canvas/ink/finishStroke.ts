import { createShapeId } from 'tldraw'
import type { Editor } from 'tldraw'
import type { InkBindingProps, InkStroke, WordTarget } from '@shared/study/types'
import { inkWordAnchor, wordAtScreenPoint } from '../bindings/words'
import { HEAD_LENGTH, WORD_GAP, type Point } from '../bindings/terminals'
import type { NoteShape, PassageShape } from '../shapes/types'
import { classifyStroke } from './classifyStroke'
import { NOTE_INK_HEIGHT, NOTE_INK_INSET, NOTE_INK_WIDTH, noteInkHeight } from './notePad'
import { INK_SIZE, mapStroke, strokeApproach } from './stroke'

type InkHit =
	| { kind: 'word'; shape: PassageShape; word: WordTarget; element: Element }
	| { kind: 'block'; shape: PassageShape }
	| { kind: 'note'; shape: NoteShape }

export function inkTargetAt({
	editor,
	point,
}: {
	editor: Editor
	point: Point
}): InkHit | undefined {
	const shape = editor.getShapeAtPoint(point, {
		hitInside: true,
		hitLocked: true,
		filter: (candidate) => candidate.type === 'passage' || candidate.type === 'margin-note',
	})
	if (shape?.type === 'margin-note') return { kind: 'note', shape }
	if (shape?.type !== 'passage') return
	const hit = wordAtScreenPoint(editor, editor.pageToScreen(point))
	return hit?.shape.id === shape.id
		? { kind: 'word', shape, word: hit.target, element: hit.element }
		: { kind: 'block', shape }
}

function bindTerminal({
	editor,
	hit,
	points,
	terminal,
}: {
	editor: Editor
	hit: InkHit
	points: InkStroke
	terminal: InkBindingProps['terminal']
}): { toId: InkHit['shape']['id']; props: InkBindingProps } {
	const point = (terminal === 'start' ? points[0] : points.at(-1)) ?? points[0]
	const { shape } = hit
	const pageDirection = strokeApproach({ points, terminal })
	const local = editor.getPointInShapeSpace(shape, point)
	const neighbour = editor.getPointInShapeSpace(shape, {
		x: point.x + pageDirection.x,
		y: point.y + pageDirection.y,
	})
	const direction = { x: neighbour.x - local.x, y: neighbour.y - local.y }
	if (hit.kind === 'word') {
		return {
			toId: shape.id,
			props: {
				terminal,
				anchor: {
					kind: 'word',
					target: hit.word,
					direction,
					point: inkWordAnchor({
						editor,
						shape: hit.shape,
						element: hit.element,
						direction,
						terminal,
					}),
				},
			},
		}
	}
	const bounds = editor.getShapeGeometry(shape).bounds
	const x = local.x - bounds.x
	const y = local.y - bounds.y
	const gap = terminal === 'end' ? HEAD_LENGTH / 2 : WORD_GAP
	const leftEdge = { distance: x, point: { x: -gap / bounds.w, y: y / bounds.h } }
	const nearest = [
		{ distance: bounds.w - x, point: { x: 1 + gap / bounds.w, y: y / bounds.h } },
		{ distance: y, point: { x: x / bounds.w, y: -gap / bounds.h } },
		{ distance: bounds.h - y, point: { x: x / bounds.w, y: 1 + gap / bounds.h } },
	].reduce((best, edge) => (edge.distance < best.distance ? edge : best), leftEdge)
	return { toId: shape.id, props: { terminal, anchor: { kind: 'block', point: nearest.point } } }
}

function noteStroke({
	editor,
	note,
	points,
}: {
	editor: Editor
	note: NoteShape
	points: InkStroke
}) {
	const local = mapStroke({ points, map: (point) => editor.getPointInShapeSpace(note, point) })
	const { w, h, strokes } = note.props
	const padHeight = noteInkHeight(w)
	const padTop = h - NOTE_INK_INSET - padHeight
	const padScale = NOTE_INK_HEIGHT / padHeight
	if (
		strokes.length &&
		local.every(
			({ x, y }) =>
				x >= NOTE_INK_INSET && x <= w - NOTE_INK_INSET && y >= padTop && y <= h - NOTE_INK_INSET,
		)
	) {
		return mapStroke({
			points: local,
			map: ({ x, y }) => ({ x: (x - NOTE_INK_INSET) * padScale, y: (y - padTop) * padScale }),
		})
	}
	const scale = Math.min(NOTE_INK_WIDTH / w, NOTE_INK_HEIGHT / h)
	return mapStroke({
		points: local,
		map: ({ x, y }) => ({
			x: (x - w / 2) * scale + NOTE_INK_WIDTH / 2,
			y: (y - h / 2) * scale + NOTE_INK_HEIGHT / 2,
		}),
	})
}

export function finishStroke({
	editor,
	points,
	startHit,
	staysInStartNote,
	zoom,
}: {
	editor: Editor
	points: InkStroke
	startHit: InkHit | undefined
	staysInStartNote: boolean
	zoom: number
}) {
	const start = points[0]
	const end = points.at(-1) ?? start
	const intent = classifyStroke({
		points,
		start: startHit,
		end: inkTargetAt({ editor, point: end }),
		staysInStartNote,
		zoom,
	})
	if (intent.kind === 'handwriting') {
		const note = editor.getShape(intent.noteId)
		if (note?.type === 'margin-note' && !note.isLocked) {
			editor.markHistoryStoppingPoint('write in note')
			const stroke = noteStroke({ editor, note, points })
			editor.updateShape({
				id: note.id,
				type: note.type,
				props: { strokes: [...note.props.strokes, stroke] },
			})
			return
		}
	}
	const bindings =
		intent.kind === 'arrow'
			? [
					bindTerminal({ editor, hit: intent.start, points, terminal: 'start' }),
					bindTerminal({ editor, hit: intent.end, points, terminal: 'end' }),
				]
			: []
	const id = createShapeId()
	editor.markHistoryStoppingPoint('draw ink')
	editor.run(() => {
		editor.createShape({
			id,
			type: 'margin-ink',
			x: start.x,
			y: start.y,
			props: {
				kind: intent.kind === 'arrow' ? 'arrow' : 'ink',
				size: INK_SIZE,
				points: mapStroke({ points, map: ({ x, y }) => ({ x: x - start.x, y: y - start.y }) }),
			},
		})
		editor.createBindings(
			bindings.map((binding) => ({ ...binding, type: 'margin-ink', fromId: id })),
		)
	})
}
