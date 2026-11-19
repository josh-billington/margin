import {
	MousePointer2,
	Hand,
	StickyNote,
	MoveUpRight,
	Highlighter,
	BookOpen,
	Minus,
	Plus,
	Tag,
} from 'lucide-react'
import { EASINGS, useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { runCommand, shortcutFor, titleFor } from './commands'
import { requestTagSelection } from '../canvas/highlights/tagging'
import { ToolButton } from './ToolButton'
import { noteFromSelection } from '../canvas/tools/noteFromSelection'
import { iconLg } from '../lib/icons'
import { prefersReducedMotion } from '../canvas/focus/camera'

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
	return (
		<div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
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
			<ToolButton
				label="Arrow"
				shortcut="A"
				aria-pressed={tool === 'arrow'}
				onClick={() => editor?.setCurrentTool('arrow')}
			>
				<MoveUpRight {...iconLg} />
			</ToolButton>
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
			<ToolButton
				label={titleFor('view.zoomOut')}
				shortcut={shortcutFor('view.zoomOut')}
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
				onClick={() => editor?.zoomIn(undefined, zoomMotion())}
			>
				<Plus {...iconLg} />
			</ToolButton>
		</div>
	)
}
