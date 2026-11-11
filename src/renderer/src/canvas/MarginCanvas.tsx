import { useCallback, useRef } from 'react'
import { SelectionForegroundOverlayUtil, ShapeIndicatorOverlayUtil, Tldraw } from 'tldraw'
import type { Editor, TLContent } from 'tldraw'
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'

import { PassageShapeUtil } from './shapes/passage/PassageShapeUtil'
import { NoteShapeUtil } from './shapes/note/NoteShapeUtil'
import { MarginArrowShapeUtil } from './bindings/MarginArrowShapeUtil'
import { installWordTerminals } from './bindings/words'
import { NoteTool, HighlightTool } from './tools/NoteTool'
import { installCanvasCommands, insertPassage } from './tools/commands'
import { amosFixture, psalmFixture } from './fixtures/passages'
import { installSpacePan } from './tools/spacePan'
import { runM0Checks } from './devChecks'
import { installAnnotationBehavior, withReferencedTags } from './annotations/editorOps'
import { validateLoadedAnnotations } from './annotations/recovery'
import { LookupOverlay } from './lookup/LookupPopover'
import { installLookupContextMenu } from './lookup/store'
import { FocusLayer } from './focus/FocusLayer'
import { installFocusShortcuts } from './focus/shortcuts'
import { useAppearance } from '../app/glass'
import './canvas.css'

const shapeUtils = [PassageShapeUtil, NoteShapeUtil, MarginArrowShapeUtil]
const tools = [NoteTool, HighlightTool]
const components = {
	OnTheCanvas: () => (
		<>
			<FocusLayer />
			<LookupOverlay />
		</>
	),
}
/** Hairline selection: the default 1.5px box plus 1.5px indicator read as a heavy 2px frame on text. */
const overlayUtils = [
	ShapeIndicatorOverlayUtil.configure({ lineWidth: 1, hintedLineWidth: 1.5 }),
	SelectionForegroundOverlayUtil.configure({ lineWidth: 1 }),
]
/** tldraw's canvas paints from its theme, not CSS, so these mirror tokens.css (--canvas-bg, --pen, --accent). */
const canvasColors = {
	dark: {
		background: '#141115',
		ink: '#FAFAFA',
		accent: '#00A2FF',
		selectionFill: 'rgba(0, 162, 255, 0.12)',
	},
	light: {
		background: '#F7F4F0',
		ink: '#3A3540',
		accent: '#0067C8',
		selectionFill: 'rgba(0, 103, 200, 0.1)',
	},
}
const canvasOptions = {
	createTextOnCanvasDoubleClick: false,
	onBeforeCopyToClipboard: ({ editor, content }: { editor: Editor; content: TLContent }) =>
		withReferencedTags(editor, content),
}
const assetUrls = getAssetUrlsByImport((url) => new URL(url, document.baseURI).href)

export function MarginCanvas({ onMount }: { onMount: (editor: Editor) => void }) {
	// Tldraw remounts its editor when the onMount identity changes, so keep it stable.
	const latest = useRef(onMount)
	latest.current = onMount
	const handleMount = useCallback((editor: Editor) => {
		return mountEditor(editor, (mounted) => latest.current(mounted))
	}, [])
	const appearance = useAppearance()
	return (
		<div className="margin-canvas">
			<Tldraw
				hideUi
				components={components}
				overlayUtils={overlayUtils}
				options={canvasOptions}
				shapeUtils={shapeUtils}
				tools={tools}
				colorScheme={appearance}
				assetUrls={assetUrls}
				licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
				onMount={handleMount}
			/>
		</div>
	)
}

function mountEditor(editor: Editor, onMount: (editor: Editor) => void) {
	editor.setCameraOptions({ zoomSteps: [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] })
	editor.updateThemes((themes) => {
		const paint = (scheme: 'light' | 'dark') => {
			const base = themes.default.colors[scheme]
			const palette = canvasColors[scheme]
			return {
				...base,
				background: palette.background,
				...(scheme === 'light' && { negativeSpace: palette.background }),
				selectionStroke: palette.accent,
				selectionFill: palette.selectionFill,
				// Margin's "ink": arrows, arrowheads and the connector use tldraw's white slot.
				white: { ...base.white, solid: palette.ink, fill: palette.ink },
			}
		}
		return {
			...themes,
			default: {
				...themes.default,
				colors: { ...themes.default.colors, light: paint('light'), dark: paint('dark') },
			},
		}
	})
	if (import.meta.env.DEV)
		window.marginCanvasDev = {
			editor,
			runM0Checks: () => runM0Checks(editor),
			insertFixture: (name) =>
				void insertPassage(editor, name === 'psalm' ? psalmFixture : amosFixture),
		}
	onMount(editor)
	validateLoadedAnnotations(editor)
	const removeTerminals = installWordTerminals(editor)
	const removeBehavior = installAnnotationBehavior(editor)
	const removeCommands = installCanvasCommands(editor)
	const removeFocus = installFocusShortcuts(editor)
	const removeSpacePan = installSpacePan(editor)
	const removeLookup = installLookupContextMenu(editor)
	return () => {
		removeTerminals()
		removeBehavior()
		removeCommands()
		removeFocus()
		removeSpacePan()
		removeLookup()
	}
}
