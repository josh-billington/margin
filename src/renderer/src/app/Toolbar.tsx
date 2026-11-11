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
import { useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { runCommand, shortcutFor } from './commands'
import { requestTagSelection } from '../canvas/highlights/tagging'
import { ToolButton } from './ToolButton'
import { noteFromSelection } from '../canvas/tools/noteFromSelection'
import { iconLg } from '../lib/icons'

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
			<ToolButton
				label="Add verses"
				shortcut={shortcutFor('palette.toggle')}
				onClick={() => runCommand('passage.add')}
			>
				<BookOpen {...iconLg} />
			</ToolButton>
			<span className="toolbar-divider" aria-hidden="true" />
			<ToolButton label="Zoom out" onClick={() => editor?.zoomOut()}>
				<Minus {...iconLg} />
			</ToolButton>
			<ToolButton
				label="Reset zoom to 100%"
				shortcut="⌘1"
				className="zoom-button"
				onClick={() => editor?.resetZoom()}
			>
				{zoom}%
			</ToolButton>
			<ToolButton label="Zoom in" onClick={() => editor?.zoomIn()}>
				<Plus {...iconLg} />
			</ToolButton>
		</div>
	)
}
