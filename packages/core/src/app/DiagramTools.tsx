import * as Popover from '@radix-ui/react-popover'
import { Circle, Slash, Square, Type } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { iconSm } from '../lib/icons'
import { chooseDiagramTool, currentDiagramTool, isDiagramShape } from '../canvas/diagrams/tools'
import type { DiagramTool } from '../canvas/diagrams/tools'
import { diagramColour, recolourDiagrams } from '../canvas/diagrams/shapeUtils'
import type { DiagramColour } from '../canvas/diagrams/shapeUtils'
import { ColorChoices } from './ColorChoices'
import { ToolButton } from './ToolButton'
import './diagram-tools.css'

const choices = {
	rectangle: { label: 'Rectangle', shortcut: 'R', Icon: Square },
	ellipse: { label: 'Ellipse', shortcut: 'O', Icon: Circle },
	line: { label: 'Line', shortcut: 'L', Icon: Slash },
	text: { label: 'Text label', shortcut: 'Y', Icon: Type },
} satisfies Record<DiagramTool, { label: string; shortcut: string; Icon: typeof Square }>
const tools: DiagramTool[] = ['rectangle', 'ellipse', 'line', 'text']

export function DiagramTools({ editor }: { editor: Editor | null }) {
	const [open, setOpen] = useState(false)
	const [last, setLast] = useState<DiagramTool>('rectangle')
	const returnToCanvas = useRef(false)
	const active = useValue('active diagram tool', () => editor && currentDiagramTool(editor), [
		editor,
	])
	useEffect(() => {
		if (active) setLast(active)
	}, [active])
	const selection = useValue(
		'diagram colours',
		() =>
			open
				? editor
						?.getSelectedShapes()
						.filter(isDiagramShape)
						.filter((shape) => !shape.isLocked)
				: undefined,
		[editor, open],
	)
	const current = selection?.[0] && diagramColour(selection[0])
	const colour =
		current && selection.every((shape) => diagramColour(shape) === current) ? current : null
	const recolour = (next: DiagramColour) => {
		if (!editor || !selection) return
		recolourDiagrams({ editor, shapes: selection, colour: next })
		returnToCanvas.current = true
	}
	const { Icon, label } = choices[active ?? last]
	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>
				<ToolButton
					label="Shapes"
					tip={`Shapes · ${label}`}
					aria-pressed={!!active}
					disabled={!editor}
				>
					<Icon {...iconSm} />
				</ToolButton>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					aria-label="Shapes"
					className="margin-popover diagram-popover"
					side="top"
					sideOffset={14}
					onInteractOutside={() => {
						returnToCanvas.current = false
					}}
					onCloseAutoFocus={(event) => {
						if (!returnToCanvas.current) return
						returnToCanvas.current = false
						event.preventDefault()
						editor?.focus()
					}}
				>
					<div className="diagram-choices" role="group" aria-label="Diagram tools">
						{tools.map((tool) => {
							const { label, shortcut, Icon } = choices[tool]
							return (
								<button
									key={tool}
									type="button"
									aria-pressed={tool === (active ?? last)}
									aria-keyshortcuts={shortcut}
									onClick={() => {
										if (!editor) return
										chooseDiagramTool({ editor, tool })
										setLast(tool)
										returnToCanvas.current = true
										setOpen(false)
									}}
								>
									<Icon {...iconSm} />
									{label}
									<kbd aria-hidden="true">{shortcut}</kbd>
								</button>
							)
						})}
					</div>
					{!!selection?.length && (
						<div className="diagram-colour">
							<span>Colour</span>
							<ColorChoices
								label="Shape colour"
								value={colour === 'ink' ? null : colour}
								onChange={recolour}
								ink={{ pressed: colour === 'ink', onClick: () => recolour('ink') }}
							/>
						</div>
					)}
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	)
}
