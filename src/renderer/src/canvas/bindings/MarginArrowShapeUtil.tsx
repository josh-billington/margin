import {
	ArrowShapeUtil,
	Group2d,
	PI,
	Polygon2d,
	SVGContainer,
	Vec,
	clamp,
	createBindingId,
	getArrowInfo,
	getDisplayValues,
	intersectCircleCircle,
} from 'tldraw'
import type {
	Editor,
	SvgExportContext,
	TLArrowBinding,
	TLArrowInfo,
	TLArrowShape,
	TLHandleDragInfo,
	VecLike,
} from 'tldraw'
import { wordBindingMetadataSchema } from '@shared/study/types'
import { HEAD_LENGTH } from './terminals'
import { outwardWordBend, wordAnchorForElement, wordAtScreenPoint } from './words'

/** Head base point `length` back from the tip, following the body (mirrors tldraw's arrowheads.ts). */
function headBase(info: TLArrowInfo, side: 'start' | 'end', length: number): VecLike {
	const point = info[side].point
	switch (info.type) {
		case 'straight': {
			const opposite = side === 'end' ? info.start.point : info.end.point
			return Vec.Nudge(point, opposite, clamp(Vec.Dist(opposite, point) / 3, 0, length))
		}
		case 'arc': {
			const l = clamp(Math.abs(info.bodyArc.length) / 3, 0, length)
			const [a, b] = intersectCircleCircle(point, l, info.handleArc.center, info.handleArc.radius)
			const first = side === 'end' ? info.handleArc.sweepFlag : !info.handleArc.sweepFlag
			return (first ? a : b) ?? point
		}
		case 'elbow': {
			const points = info.route.points
			const previous = side === 'end' ? points[points.length - 2] : points[1]
			return previous
				? Vec.Nudge(point, previous, Math.min(length, Vec.Dist(previous, point) / 2))
				: point
		}
	}
}
function headPoints(info: TLArrowInfo, side: 'start' | 'end', length: number) {
	if (info[side].arrowhead !== 'triangle') return null
	const point = Vec.From(info[side].point),
		base = headBase(info, side, length)
	if (Vec.IsNaN(base) || Vec.Dist(base, point) < 1) return null
	return [Vec.RotWith(base, point, PI / 6), point, Vec.RotWith(base, point, -PI / 6)] as const
}
function headPath(info: TLArrowInfo, side: 'start' | 'end', length: number) {
	const points = headPoints(info, side, length)
	if (!points) return null
	const [left, tip, right] = points
	return `M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y} Z`
}

/**
 * Preserve native arrows, binding lifecycle, bend handles, and snapshot schema. The larger head is
 * drawn over tldraw's own: both share the tip and the 30° half-angle, so the small one is covered.
 */
export class MarginArrowShapeUtil extends ArrowShapeUtil {
	constructor(editor: Editor) {
		super(editor)
		const defaults = this.options.getDefaultDisplayValues
		this.options = {
			...this.options,
			getDefaultDisplayValues: (...args) => ({ ...defaults(...args), strokeWidth: 2.5 }),
		}
	}
	private headPaths(shape: TLArrowShape) {
		const info = getArrowInfo(this.editor, shape)
		if (!info?.isValid) return []
		return (['start', 'end'] as const).flatMap((side) => {
			const d = headPath(info, side, HEAD_LENGTH * shape.props.scale)
			return d ? [d] : []
		})
	}
	/** The larger heads join the hit area; label stays `children[1]`, which tldraw reads. */
	override getGeometry(shape: TLArrowShape): Group2d {
		const geometry = super.getGeometry(shape)
		const info = getArrowInfo(this.editor, shape)
		if (!info?.isValid) return geometry
		const heads = (['start', 'end'] as const).flatMap((side) => {
			const points = headPoints(info, side, HEAD_LENGTH * shape.props.scale)
			return points ? [new Polygon2d({ points: [...points], isFilled: true })] : []
		})
		return heads.length ? new Group2d({ children: [...geometry.children, ...heads] }) : geometry
	}
	/** Hover and selection outline trace the drawn 14px head, not tldraw's 7.5px one. */
	override getIndicatorPath(shape: TLArrowShape): ReturnType<ArrowShapeUtil['getIndicatorPath']> {
		const base = super.getIndicatorPath(shape)
		const heads = this.headPaths(shape).map((d) => new Path2D(d))
		if (!base || !heads.length) return base
		if (base instanceof Path2D) {
			heads.forEach((head) => base.addPath(head))
			return base
		}
		heads.forEach((head) => base.clipPath.addPath(head))
		return { ...base, additionalPaths: [...base.additionalPaths, ...heads] }
	}
	private heads(shape: TLArrowShape) {
		const info = getArrowInfo(this.editor, shape)
		if (!info?.isValid) return null
		const { strokeColor, strokeWidth } = getDisplayValues(this, shape)
		const scale = shape.props.scale
		const paths = (['start', 'end'] as const).flatMap((side) => {
			const d = headPath(info, side, HEAD_LENGTH * scale)
			return d ? [<path key={side} d={d} />] : []
		})
		if (!paths.length) return null
		return (
			<g
				fill={strokeColor}
				stroke={strokeColor}
				strokeWidth={strokeWidth * scale}
				strokeLinejoin="round"
				strokeLinecap="round"
				pointerEvents="none"
			>
				{paths}
			</g>
		)
	}
	override component(shape: TLArrowShape) {
		return (
			<>
				{super.component(shape)}
				<SVGContainer>{this.heads(shape)}</SVGContainer>
			</>
		)
	}
	override toSvg(shape: TLArrowShape, ctx: SvgExportContext) {
		const base = super.toSvg(shape, ctx)
		if (!base || base instanceof Promise) return base
		return (
			<g>
				{base}
				{this.heads(shape)}
			</g>
		)
	}
	override onBeforeCreate(shape: TLArrowShape): TLArrowShape {
		return {
			...shape,
			props: {
				...shape.props,
				color: 'white',
				dash: 'draw',
				size: 's',
				fill: 'solid',
				arrowheadEnd: 'triangle',
			},
		}
	}
	override getDefaultProps(): TLArrowShape['props'] {
		return {
			...super.getDefaultProps(),
			color: 'white',
			dash: 'draw',
			size: 's',
			fill: 'solid',
			arrowheadEnd: 'triangle',
			bend: 28,
		}
	}
	override onHandleDrag(
		shape: TLArrowShape,
		info: TLHandleDragInfo<TLArrowShape>,
	): ReturnType<ArrowShapeUtil['onHandleDrag']> {
		const update = super.onHandleDrag(shape, info)
		const terminal = info.handle.id
		if (terminal !== 'start' && terminal !== 'end') return update
		const pagePoint = this.editor.getShapePageTransform(shape).applyToPoint(info.handle)
		const hit = wordAtScreenPoint(this.editor, this.editor.pageToScreen(pagePoint))
		const binding = this.editor
			.getBindingsFromShape<TLArrowBinding>(shape.id, 'arrow')
			.find((b) => b.props.terminal === terminal)
		if (hit) {
			// A new arrow arcs towards the block margin rather than into the text; edited arrows keep theirs.
			const bend = info.isCreatingShape
				? outwardWordBend(this.editor, shape, terminal, hit.shape, hit.element)
				: shape.props.bend
			const props: TLArrowBinding['props'] = {
				terminal,
				normalizedAnchor: wordAnchorForElement(
					this.editor,
					shape,
					terminal,
					hit.shape,
					hit.element,
					bend,
				),
				isPrecise: true,
				isExact: true,
				snap: 'none',
			}
			const meta = { schemaVersion: 1, target: hit.target }
			if (binding)
				this.editor.updateBinding({
					id: binding.id,
					type: 'arrow',
					toId: hit.shape.id,
					props,
					meta,
				})
			else
				this.editor.createBinding({
					id: createBindingId(),
					type: 'arrow',
					fromId: shape.id,
					toId: hit.shape.id,
					props,
					meta,
				})
			if (bend !== shape.props.bend)
				return { ...update, id: shape.id, type: 'arrow', props: { ...update?.props, bend } }
		} else if (binding && this.editor.getShape(binding.toId)?.type === 'passage') {
			this.editor.deleteBindings([binding.id])
			return {
				...update,
				id: shape.id,
				type: 'arrow',
				props: { ...update?.props, [terminal]: { x: info.handle.x, y: info.handle.y } },
			}
		} else if (binding && wordBindingMetadataSchema.safeParse(binding.meta).success) {
			this.editor.updateBinding({ id: binding.id, type: 'arrow', meta: {} })
		}
		return update
	}
}
