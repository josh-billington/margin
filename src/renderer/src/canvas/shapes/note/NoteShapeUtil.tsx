import { ShapeUtil, Rectangle2d } from 'tldraw'
import type { TLResizeInfo } from 'tldraw'
import { noteMigrations, noteValidators } from '../types'
import type { NoteShape } from '../types'
import { NoteComponent } from './NoteComponent'

export const noteSizes = { S: 18, M: 22, L: 28, XL: 36 }
export class NoteShapeUtil extends ShapeUtil<NoteShape> {
	static override type = 'margin-note' as const
	static override props = noteValidators
	static override migrations = noteMigrations
	override getDefaultProps(): NoteShape['props'] {
		return { text: '', size: 'M', color: 'ink', font: 'handwritten', w: 180, h: 40 }
	}
	getGeometry(shape: NoteShape) {
		return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
	}
	override hideRotateHandle() {
		return true
	}
	override canEdit() {
		return true
	}
	override onResize(shape: NoteShape, info: TLResizeInfo<NoteShape>) {
		const width = Math.max(60, shape.props.w * Math.abs(info.scaleX))
		return { id: shape.id, type: shape.type, props: { width, w: width } }
	}
	component(shape: NoteShape) {
		return <NoteComponent shape={shape} editor={this.editor} />
	}
	getIndicatorPath(shape: NoteShape) {
		const path = new Path2D()
		path.rect(0, 0, shape.props.w, shape.props.h)
		return path
	}
}
