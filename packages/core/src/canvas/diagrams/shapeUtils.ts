import { GeoShapeUtil, LineShapeUtil, TextShapeUtil } from 'tldraw'
import type { Editor, TLGeoShape, TLLineShape, TLTextShape } from 'tldraw'
import type { PaletteColor } from '@shared/study/types'
import { isDiagramRecord } from '@shared/study/diagrams'
import type { DiagramShape } from './tools'

export type DiagramColour = 'ink' | PaletteColor

const colourSlots = {
	ink: 'white',
	sky: 'blue',
	violet: 'violet',
	rose: 'light-red',
	coral: 'red',
	amber: 'orange',
	green: 'green',
} satisfies Record<DiagramColour, DiagramShape['props']['color']>

const colours = {
	light: {
		sky: '#0067C8',
		violet: '#6C4FD6',
		rose: '#C2185F',
		coral: '#C73320',
		amber: '#A05600',
		green: '#167347',
	},
	dark: {
		sky: '#00A2FF',
		violet: '#A78BFF',
		rose: '#FF5FB0',
		coral: '#FF6B5B',
		amber: '#F2A23A',
		green: '#30B377',
	},
} satisfies Record<'light' | 'dark', Record<PaletteColor, string>>

export function diagramColour(shape: DiagramShape): DiagramColour {
	switch (shape.props.color) {
		case colourSlots.sky:
			return 'sky'
		case colourSlots.violet:
			return 'violet'
		case colourSlots.rose:
			return 'rose'
		case colourSlots.coral:
			return 'coral'
		case colourSlots.amber:
			return 'amber'
		case colourSlots.green:
			return 'green'
		default:
			return 'ink'
	}
}

export function recolourDiagrams({
	editor,
	shapes,
	colour,
}: {
	editor: Editor
	shapes: DiagramShape[]
	colour: DiagramColour
}) {
	if (editor.getIsReadonly()) return
	const changed = shapes.filter((shape) => !shape.isLocked && diagramColour(shape) !== colour)
	if (!changed.length) return
	const color = colourSlots[colour]
	editor.markHistoryStoppingPoint('diagram colour')
	editor.updateShapes(changed.map(({ id, type }) => ({ id, type, props: { color } })))
}

function diagramDisplayColour({
	shape,
	mode,
	ink,
}: {
	shape: DiagramShape
	mode: 'light' | 'dark'
	ink: string
}) {
	const colour = diagramColour(shape)
	return colour === 'ink' ? ink : colours[mode][colour]
}

const diagramMetadata = { marginDiagram: true }

class DiagramGeoUtil extends GeoShapeUtil {
	override onBeforeCreate(shape: TLGeoShape): TLGeoShape {
		const next: TLGeoShape =
			this.editor.getCurrentToolId() === 'geo' && !isDiagramRecord(shape)
				? {
						...shape,
						meta: { ...shape.meta, ...diagramMetadata },
						props: {
							...shape.props,
							color: colourSlots.ink,
							dash: 'solid',
							fill: 'none',
							size: 's',
							font: 'sans',
						},
					}
				: shape
		return super.onBeforeCreate(next) ?? next
	}
}

class DiagramLineUtil extends LineShapeUtil {
	override onBeforeCreate(shape: TLLineShape): TLLineShape {
		const next: TLLineShape =
			this.editor.getCurrentToolId() === 'line' && !isDiagramRecord(shape)
				? {
						...shape,
						meta: { ...shape.meta, ...diagramMetadata },
						props: {
							...shape.props,
							color: colourSlots.ink,
							dash: 'solid',
							spline: 'line',
							size: 's',
						},
					}
				: shape
		return super.onBeforeCreate(next) ?? next
	}
}

class DiagramTextUtil extends TextShapeUtil {
	override onBeforeCreate(shape: TLTextShape): TLTextShape {
		if (this.editor.getCurrentToolId() !== 'text' || isDiagramRecord(shape)) return shape
		return {
			...shape,
			meta: { ...shape.meta, ...diagramMetadata },
			props: {
				...shape.props,
				color: colourSlots.ink,
				size: 's',
				font: 'sans',
			},
		}
	}
}

export const diagramShapeUtils = [
	DiagramGeoUtil.configure({
		getCustomDisplayValues(_editor, shape, theme, mode) {
			if (!isDiagramRecord(shape)) return {}
			const color = diagramDisplayColour({ shape, mode, ink: theme.colors[mode].white.solid })
			return { strokeColor: color, labelColor: color }
		},
	}),
	DiagramLineUtil.configure({
		getCustomDisplayValues(_editor, shape, theme, mode) {
			if (!isDiagramRecord(shape)) return {}
			return {
				strokeColor: diagramDisplayColour({ shape, mode, ink: theme.colors[mode].white.solid }),
			}
		},
	}),
	DiagramTextUtil.configure({
		getCustomDisplayValues(_editor, shape, theme, mode) {
			if (!isDiagramRecord(shape)) return {}
			return { color: diagramDisplayColour({ shape, mode, ink: theme.colors[mode].white.solid }) }
		},
	}),
]
