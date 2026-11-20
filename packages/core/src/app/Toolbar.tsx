import {
	MousePointer2,
	Hand,
	StickyNote,
	MoveUpRight,
	PencilLine,
	Highlighter,
	BookOpen,
	Maximize,
	Minus,
	Plus,
	Redo2,
	Tag,
	Undo2,
} from 'lucide-react'
import { EASINGS, useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { runCommand, shortcutFor, titleFor } from './commands'
import { requestTagSelection } from '../canvas/highlights/tagging'
import { ToolButton } from './ToolButton'
import { noteFromSelection } from '../canvas/tools/noteFromSelection'
import { iconLg } from '../lib/icons'
import { prefersReducedMotion } from '../canvas/focus/camera'
import { platform } from '../lib/platform'
import { DrawTool } from '../canvas/ink/tools'
import { DiagramTools } from './DiagramTools'
import { useToolbarGlass } from './toolbarGlass'

// Clicks animate so the reader keeps their place; ⌘+ / ⌘− stay instant.
const zoomMotion = () =>
	prefersReducedMotion()
		? undefined
		: { animation: { duration: 200, easing: EASINGS.easeOutCubic } }

interface ToolbarProps {
	editor: Editor | null
}

export function Toolbar({ editor }: ToolbarProps) {
	const tool = useValue('active tool', () => editor?.getCurrentToolId() ?? 'select', [editor])
	const zoom = useValue('zoom', () => Math.round((editor?.getZoomLevel() ?? 1) * 100), [editor])
	// A host without a menu bar has no other pointer route to undo, redo and fit.
	const menuCommands = !platform.nativeMenu
	const glass = useToolbarGlass()
	return (
		<div
			ref={glass.ref}
			className="canvas-toolbar"
			role="toolbar"
			aria-label="Canvas tools"
			{...glass.props}
		>
			{glass.defs}
			<ToolButton
				label="Select"
				shortcut="V"
				aria-pressed={tool === 'select'}
				onClick={() => editor?.setCurrentTool('select')}
			>
				<MousePointer2 {...iconLg} />
			</ToolButton>
			<ToolButton
				label="Hand"
				shortcut="Space"
				aria-pressed={tool === 'hand'}
				onClick={() => editor?.setCurrentTool('hand')}
			>
				<Hand {...iconLg} />
			</ToolButton>
			<ToolButton
				label="Note"
				shortcut="T"
				aria-pressed={tool === 'margin-note'}
				onClick={() =>
					editor && (noteFromSelection(editor) || editor.setCurrentTool('margin-note'))
				}
			>
				<StickyNote {...iconLg} />
			</ToolButton>
			{platform.freehandInk && (
				<ToolButton
					label="Draw"
					shortcut="D"
					aria-pressed={tool === DrawTool.id}
					onClick={() => editor?.setEditingShape(null).setCurrentTool(DrawTool.id)}
				>
					<PencilLine {...iconLg} />
				</ToolButton>
			)}
			{platform.kind === 'mac' && (
				<ToolButton
					label="Arrow"
					shortcut="A"
					aria-pressed={tool === 'arrow'}
					onClick={() => editor?.setCurrentTool('arrow')}
				>
					<MoveUpRight {...iconLg} />
				</ToolButton>
			)}
			<DiagramTools editor={editor} />
			<ToolButton
				label="Highlight"
				shortcut="H"
				aria-pressed={tool === 'highlight'}
				onClick={() => editor?.setCurrentTool('highlight')}
			>
				<Highlighter {...iconLg} />
			</ToolButton>
			<ToolButton
				label="Tag selected words"
				shortcut={shortcutFor('selection.tag')}
				onClick={() => editor && requestTagSelection(editor)}
			>
				<Tag {...iconLg} />
			</ToolButton>
			<span className="toolbar-divider" aria-hidden="true" />
			<ToolButton label={titleFor('passage.add')} onClick={() => runCommand('passage.add')}>
				<BookOpen {...iconLg} />
			</ToolButton>
			<span className="toolbar-divider" aria-hidden="true" />
			{menuCommands && (
				<>
					<ToolButton
						label={titleFor('edit.undo')}
						shortcut={shortcutFor('edit.undo')}
						onClick={() => runCommand('edit.undo')}
					>
						<Undo2 {...iconLg} />
					</ToolButton>
					<ToolButton
						label={titleFor('edit.redo')}
						shortcut={shortcutFor('edit.redo')}
						onClick={() => runCommand('edit.redo')}
					>
						<Redo2 {...iconLg} />
					</ToolButton>
					<span className="toolbar-divider" aria-hidden="true" />
				</>
			)}
			<ToolButton
				label={titleFor('view.zoomOut')}
				shortcut={shortcutFor('view.zoomOut')}
				className="zoom-step"
				onClick={() => editor?.zoomOut(undefined, zoomMotion())}
			>
				<Minus {...iconLg} />
			</ToolButton>
			<ToolButton
				label={titleFor('view.actualSize')}
				shortcut={shortcutFor('view.actualSize')}
				className="zoom-button"
				onClick={() => editor?.resetZoom(undefined, zoomMotion())}
			>
				{zoom}%
			</ToolButton>
			<ToolButton
				label={titleFor('view.zoomIn')}
				shortcut={shortcutFor('view.zoomIn')}
				className="zoom-step"
				onClick={() => editor?.zoomIn(undefined, zoomMotion())}
			>
				<Plus {...iconLg} />
			</ToolButton>
			{menuCommands && (
				<ToolButton
					label={titleFor('view.fit')}
					shortcut={shortcutFor('view.fit')}
					onClick={() => runCommand('view.fit')}
				>
					<Maximize {...iconLg} />
				</ToolButton>
			)}
		</div>
	)
}
