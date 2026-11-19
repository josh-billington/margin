import { createShapeId } from 'tldraw'
import type { Editor, TLShapeId } from 'tldraw'
import type { InkBindingProps, InkStroke } from '@shared/study/types'
import { inkWordAnchor, wordAtScreenPoint } from '../bindings/words'
import { HEAD_LENGTH, WORD_GAP } from '../bindings/terminals'
import { INK_SIZE, mapStroke, strokeApproach } from './stroke'

function hitTerminal({
	editor,
	points,
	terminal,
}: {
	editor: Editor
	points: InkStroke
	terminal: InkBindingProps['terminal']
}): { toId: TLShapeId; props: InkBindingProps } | undefined {
	const point = (terminal === 'start' ? points[0] : points.at(-1)) ?? points[0]
	const hit = wordAtScreenPoint(editor, editor.pageToScreen(point))
	const shape =
		hit?.shape ??
		editor.getShapeAtPoint(point, {
			hitInside: true,
			filter: (candidate) => candidate.type === 'passage' || candidate.type === 'margin-note',
		})
	if (!shape) return
	const pageDirection = strokeApproach({ points, terminal })
	const local = editor.getPointInShapeSpace(shape, point)
	const neighbour = editor.getPointInShapeSpace(shape, {
		x: point.x + pageDirection.x,
		y: point.y + pageDirection.y,
	})
	const direction = { x: neighbour.x - local.x, y: neighbour.y - local.y }
	if (hit) {
		return {
			toId: shape.id,
			props: {
				terminal,
				anchor: {
					kind: 'word',
					target: hit.target,
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
	const edges = [
		{ distance: x, point: { x: -gap / bounds.w, y: y / bounds.h } },
		{ distance: bounds.w - x, point: { x: 1 + gap / bounds.w, y: y / bounds.h } },
		{ distance: y, point: { x: x / bounds.w, y: -gap / bounds.h } },
		{ distance: bounds.h - y, point: { x: x / bounds.w, y: 1 + gap / bounds.h } },
	].sort((left, right) => left.distance - right.distance)
	const nearest = edges[0]
	if (nearest)
		return { toId: shape.id, props: { terminal, anchor: { kind: 'block', point: nearest.point } } }
}

export function finishArrow({ editor, points }: { editor: Editor; points: InkStroke }) {
	const start = points[0]
	const end = points.at(-1) ?? start
	const bindings =
		Math.hypot(end.x - start.x, end.y - start.y) >= 2
			? [
					hitTerminal({ editor, points, terminal: 'start' }),
					hitTerminal({ editor, points, terminal: 'end' }),
				].filter((binding) => binding !== undefined)
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
				kind: bindings.length ? 'arrow' : 'ink',
				size: INK_SIZE,
				points: mapStroke({ points, map: ({ x, y }) => ({ x: x - start.x, y: y - start.y }) }),
			},
		})
		editor.createBindings(
			bindings.map((binding) => ({ ...binding, type: 'margin-ink', fromId: id })),
		)
	})
}
