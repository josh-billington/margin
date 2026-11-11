import { StateNode, createShapeId } from 'tldraw'
import type { TLShapeId } from 'tldraw'
import { newNoteProps } from '../shapes/note/newNote'
export class NoteTool extends StateNode {
	static override id = 'margin-note'
	private noteId: TLShapeId | null = null
	override onPointerDown() {
		const point = this.editor.inputs.getCurrentPagePoint()
		this.noteId = createShapeId()
		this.editor.markHistoryStoppingPoint('create note')
		this.editor.createShape({
			id: this.noteId,
			type: 'margin-note',
			x: point.x,
			y: point.y,
			props: newNoteProps(),
		})
	}
	override onPointerMove() {
		if (!this.noteId || !this.editor.inputs.getIsDragging()) return
		const origin = this.editor.inputs.getOriginPagePoint(),
			point = this.editor.inputs.getCurrentPagePoint()
		const width = Math.max(60, Math.abs(point.x - origin.x))
		this.editor.updateShape({
			id: this.noteId,
			type: 'margin-note',
			x: Math.min(origin.x, point.x),
			props: { width, w: width },
		})
	}
	override onPointerUp() {
		if (!this.noteId) return
		const id = this.noteId
		this.noteId = null
		this.editor.setCurrentTool('select').select(id).setEditingShape(id)
	}
	override onCancel() {
		if (this.noteId) this.editor.deleteShape(this.noteId)
		this.noteId = null
		this.editor.setCurrentTool('select')
	}
}
export class HighlightTool extends StateNode {
	static override id = 'highlight'
}
