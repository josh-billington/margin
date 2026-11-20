import { GeoShapeGeoStyle } from 'tldraw'
import type { Editor, TLGeoShape, TLLineShape, TLShape, TLTextShape } from 'tldraw'
import { isDiagramRecord } from '@shared/study/diagrams'

const toolsByKey = { r: 'rectangle', o: 'ellipse', l: 'line', y: 'text' } satisfies Record<
	string,
	'rectangle' | 'ellipse' | 'line' | 'text'
>
export type DiagramTool = (typeof toolsByKey)[keyof typeof toolsByKey]
export type DiagramShape = TLGeoShape | TLLineShape | TLTextShape

export function isDiagramShape(shape: TLShape | undefined): shape is DiagramShape {
	return !!shape && isDiagramRecord(shape)
}

export function diagramToolForKey(key: string): DiagramTool | undefined {
	switch (key) {
		case 'r':
		case 'o':
		case 'l':
		case 'y':
			return toolsByKey[key]
	}
}

export function currentDiagramTool(editor: Editor): DiagramTool | undefined {
	const tool = editor.getCurrentToolId()
	if (tool === 'line' || tool === 'text') return tool
	if (tool !== 'geo') return
	return editor.getStyleForNextShape(GeoShapeGeoStyle) === 'ellipse' ? 'ellipse' : 'rectangle'
}

export function chooseDiagramTool({ editor, tool }: { editor: Editor; tool: DiagramTool }) {
	if (editor.getIsReadonly()) return
	if (tool === 'rectangle' || tool === 'ellipse') {
		editor.setStyleForNextShapes(GeoShapeGeoStyle, tool)
		editor.setCurrentTool('geo')
	} else {
		editor.setCurrentTool(tool)
	}
}
