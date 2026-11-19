import {
	BindingUtil,
	Circle2d,
	Group2d,
	Polygon2d,
	Polyline2d,
	ShapeUtil,
	SVGContainer,
	Vec,
} from 'tldraw'
import type { BindingOnShapeIsolateOptions, Editor, TLShape } from 'tldraw'
import { inkBindingPropsSchema, inkShapePropsSchema } from '@shared/study/types'
import type { InkStroke } from '@shared/study/types'
import { validator } from '../shapes/types'
import { HEAD_LENGTH } from '../bindings/terminals'
import { fitStroke, INK_SIZE, strokeApproach, strokePath } from './stroke'
import type { InkBinding, InkShape } from './types'

function fittedInk({ editor, shape }: { editor: Editor; shape: InkShape }) {
	const endpoints: Parameters<typeof fitStroke>[0] = { points: shape.props.points }
	const toLocal = editor.getShapePageTransform(shape).clone().invert()
	for (const binding of editor.getBindingsFromShape<InkBinding>(shape.id, 'margin-ink')) {
		const target = editor.getShape(binding.toId)
		if (target?.type !== 'passage' && target?.type !== 'margin-note') continue
		const bounds = editor.getShapeGeometry(target).bounds
		const { x, y } = binding.props.anchor.point
		const pagePoint = editor.getShapePageTransform(target).applyToPoint({
			x: bounds.x + x * bounds.w,
			y: bounds.y + y * bounds.h,
		})
		endpoints[binding.props.terminal] = toLocal.applyToPoint(pagePoint)
	}
	return fitStroke(endpoints)
}

function arrowHead({ points, length }: { points: InkStroke; length: number }) {
	const tip = points.at(-1) ?? points[0]
	const direction = strokeApproach({ points, terminal: 'end' })
	const magnitude = Math.hypot(direction.x, direction.y)
	if (!magnitude || !length) return []
	const backX = (direction.x / magnitude) * length
	const backY = (direction.y / magnitude) * length
	return [
		new Vec(tip.x, tip.y),
		new Vec(tip.x + backX - backY * 0.55, tip.y + backY + backX * 0.55),
		new Vec(tip.x + backX + backY * 0.55, tip.y + backY - backX * 0.55),
	]
}

const shapeHead = ({ props }: InkShape) =>
	props.kind === 'arrow'
		? arrowHead({ points: props.points, length: (HEAD_LENGTH * props.size) / INK_SIZE })
		: []

export class InkShapeUtil extends ShapeUtil<InkShape> {
	static override type: InkShape['type'] = 'margin-ink'
	static override props = {
		kind: validator(inkShapePropsSchema.shape.kind.parse),
		points: validator(inkShapePropsSchema.shape.points.parse),
		size: validator(inkShapePropsSchema.shape.size.parse),
	}
	override getDefaultProps(): InkShape['props'] {
		return { kind: 'ink', points: [{ x: 0, y: 0, z: 0.5 }], size: INK_SIZE }
	}
	override canResize() {
		return false
	}
	override hideRotateHandle() {
		return true
	}
	getGeometry(shape: InkShape) {
		const { points, scale, apply } = fittedInk({ editor: this.editor, shape })
		const size = shape.props.size * scale
		const head = shapeHead(shape).map((point) => Vec.From(apply(point)))
		const first = points[0]
		const radius = Math.max(size / 2, 0.01)
		const line =
			points.length < 2 || size === 0
				? new Circle2d({ x: first.x - radius, y: first.y - radius, radius, isFilled: true })
				: new Polyline2d({ points: points.map(({ x, y }) => new Vec(x, y)) })
		return head.length
			? new Group2d({ children: [line, new Polygon2d({ points: head, isFilled: true })] })
			: line
	}
	component(shape: InkShape) {
		const {
			matrix: { a, b, c, d, e, f },
		} = fittedInk({ editor: this.editor, shape })
		const head = shapeHead(shape)
		return (
			<SVGContainer>
				<g
					fill="var(--pen)"
					data-margin-ink={shape.props.kind}
					transform={`matrix(${a} ${b} ${c} ${d} ${e} ${f})`}
				>
					<path d={strokePath(shape.props)} />
					{head.length > 0 && <polygon points={head.map(({ x, y }) => `${x},${y}`).join(' ')} />}
				</g>
			</SVGContainer>
		)
	}
	getIndicatorPath(shape: InkShape) {
		const { matrix } = fittedInk({ editor: this.editor, shape })
		const head = shapeHead(shape)
		const path = new Path2D(strokePath(shape.props))
		const tip = head[0]
		if (tip) {
			path.moveTo(tip.x, tip.y)
			for (const point of head.slice(1)) path.lineTo(point.x, point.y)
			path.closePath()
		}
		const indicator = new Path2D()
		indicator.addPath(path, matrix)
		return indicator
	}
	override onTranslateStart(shape: InkShape) {
		const bindings = this.editor.getBindingsFromShape<InkBinding>(shape.id, 'margin-ink')
		const selected = this.editor.getSelectedShapeIds()
		const detached = bindings.filter((binding) => !selected.includes(binding.toId))
		if (!detached.length) return
		const { points, scale } = fittedInk({ editor: this.editor, shape })
		this.editor.deleteBindings(
			detached.map((binding) => binding.id),
			{ isolateShapes: false },
		)
		return {
			id: shape.id,
			type: shape.type,
			props: { points, size: shape.props.size * (scale || 1) },
		}
	}
}

export class InkBindingUtil extends BindingUtil<InkBinding> {
	static override type: InkBinding['type'] = 'margin-ink'
	static override props = {
		terminal: validator(inkBindingPropsSchema.shape.terminal.parse),
		anchor: validator(inkBindingPropsSchema.shape.anchor.parse),
	}
	getDefaultProps(): InkBinding['props'] {
		return { terminal: 'start', anchor: { kind: 'block', point: { x: 0.5, y: 0.5 } } }
	}
	override onBeforeIsolateFromShape({ binding }: BindingOnShapeIsolateOptions<InkBinding>) {
		const shape: TLShape | undefined = this.editor.getShape(binding.fromId)
		if (shape?.type !== 'margin-ink') return
		const { points, scale } = fittedInk({ editor: this.editor, shape })
		this.editor.updateShape({
			id: shape.id,
			type: shape.type,
			props: { points, size: shape.props.size * (scale || 1) },
		})
	}
}
