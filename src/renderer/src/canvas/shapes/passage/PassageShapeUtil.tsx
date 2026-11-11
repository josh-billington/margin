import { ShapeUtil, Rectangle2d } from 'tldraw'
import type { TLResizeInfo } from 'tldraw'
import { amosFixture } from '../../fixtures/passages'
import { passageMigrations, passageValidators } from '../types'
import type { PassageShape } from '../types'
import { PassageComponent } from './PassageComponent'

export class PassageShapeUtil extends ShapeUtil<PassageShape> {
	static override type = 'passage' as const
	static override props = passageValidators
	static override migrations = passageMigrations
	override getDefaultProps(): PassageShape['props'] {
		return {
			width: 720,
			h: 300,
			text: amosFixture,
			layout: 'flow',
			showVerseNumbers: true,
			showSuppliedWordItalics: true,
			fontScale: 1,
			highlights: [],
		}
	}
	getGeometry(shape: PassageShape) {
		return new Rectangle2d({ width: shape.props.width, height: shape.props.h, isFilled: true })
	}
	override canBind() {
		return true
	}
	override hideResizeHandles() {
		return true
	}
	override hideRotateHandle() {
		return true
	}
	override onResize(shape: PassageShape, info: TLResizeInfo<PassageShape>) {
		return {
			id: shape.id,
			type: shape.type,
			x: info.newPoint.x,
			y: shape.y,
			props: { width: Math.max(240, shape.props.width * Math.abs(info.scaleX)) },
		}
	}
	component(shape: PassageShape) {
		return <PassageComponent shape={shape} editor={this.editor} />
	}
	getIndicatorPath(shape: PassageShape) {
		const path = new Path2D()
		path.rect(0, 0, shape.props.width, shape.props.h)
		return path
	}
}
