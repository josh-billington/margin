import { useMemo, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { ulid } from 'ulid'
import { useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { marginPageMetadataSchema } from '@shared/study/types'
import type { PaletteColor, Tag, WordTarget } from '@shared/study/types'
import type { PassageShape } from '../shapes/types'
import { wordKey } from './ranges'
import type { Paint } from './ranges'
import { paintRange } from './applyHighlight'
import { setHighlightColor } from './highlightColor'
import { ColorChoices } from '../../app/ColorChoices'
import { iconSm } from '../../lib/icons'

export function pageTags(editor: Editor) {
	const result = marginPageMetadataSchema.safeParse(editor.getCurrentPage().meta)
	return result.success ? result.data.tags : []
}
/** Keep clear of the title bar and the floating canvas toolbar, plus a little air. */
function chromePadding() {
	const gap = 8
	const titleBar = document.querySelector('.title-bar')?.getBoundingClientRect()
	const toolbar = document.querySelector('.canvas-toolbar')?.getBoundingClientRect()
	return {
		top: (titleBar?.bottom ?? 0) + gap,
		bottom: (toolbar ? window.innerHeight - toolbar.top : 0) + gap,
		left: gap,
		right: gap,
	}
}

export function TagPopover({
	editor,
	shape,
	range,
	selectionRect,
	close,
}: {
	editor: Editor
	shape: PassageShape
	range: { start: WordTarget; end: WordTarget; x: number; y: number }
	/** Screen rect of the words being tagged; null when they are not laid out. */
	selectionRect: () => DOMRect | null
	close: () => void
}) {
	const tags = useValue('tags', () => pageTags(editor), [editor])
	const existing = shape.props.highlights.find(
		(h) => wordKey(h.start) === wordKey(range.start) && wordKey(h.end) === wordKey(range.end),
	)
	// Tagging fresh words leads with the tag form; an existing highlight keeps it tucked away.
	const [showNew, setShowNew] = useState(!existing)
	const newId = useMemo(() => ulid(), [])
	const [name, setName] = useState('')
	const [color, setColor] = useState<PaletteColor>('sky')
	// Anchor to the selected words, so the popover sits below (or above) them and never covers them.
	const rectOf = useRef(selectionRect)
	rectOf.current = selectionRect
	const anchor = useMemo(
		() => ({
			current: {
				getBoundingClientRect: () => rectOf.current() ?? new DOMRect(range.x, range.y, 0, 0),
			},
		}),
		[range.x, range.y],
	)
	const collisionPadding = useMemo(() => chromePadding(), [])
	const apply = (paint: Paint | null, newTag?: Tag) => {
		editor.run(() => {
			if (newTag)
				editor.updatePage({
					id: editor.getCurrentPageId(),
					meta: {
						...editor.getCurrentPage().meta,
						schemaVersion: 1,
						tags: [...tags, newTag],
					},
				})
			paintRange(editor, shape, range.start, range.end, paint, 'tag selection')
		})
		close()
	}
	const recolour = (color: PaletteColor) => {
		setHighlightColor(color)
		apply({ color })
	}
	return (
		<Popover.Root
			open
			onOpenChange={(open) => {
				if (!open) close()
			}}
		>
			{/* A virtual anchor: a fixed element inside the transformed shape would be offset by the camera. */}
			<Popover.Anchor virtualRef={anchor} />
			<Popover.Portal>
				<Popover.Content
					className="margin-popover"
					side="bottom"
					align="start"
					sideOffset={8}
					collisionPadding={collisionPadding}
					onPointerDown={(e) => e.stopPropagation()}
					// Focusing the first swatch would ring it as if it were the current colour.
					onOpenAutoFocus={(e) => {
						if (!existing) return
						e.preventDefault()
						;(e.currentTarget as HTMLElement).focus()
					}}
					aria-label={existing ? 'Highlight' : 'Tag selected words'}
				>
					<strong>{existing ? 'Highlight' : 'Tag selected words'}</strong>
					{existing && (
						<ColorChoices
							label="Highlight color"
							value={existing.color ?? null}
							onChange={recolour}
						/>
					)}
					{existing && tags.length > 0 && <span className="popover-section-label">Add to tag</span>}
					{tags.length > 0 && (
						<div className="popover-tags" role="group" aria-label="Tags">
							{tags.map((tag) => (
								<button
									key={tag.id}
									className="popover-tag"
									aria-pressed={tag.id === existing?.tagId}
									onClick={() => apply({ tagId: tag.id })}
								>
									<span
										className="tag-swatch"
										style={{ background: `var(--${tag.color})` }}
										aria-hidden="true"
									/>
									<span className="tag-name">{tag.name}</span>
									{tag.id === existing?.tagId && <Check {...iconSm} aria-hidden="true" />}
								</button>
							))}
						</div>
					)}
					{!showNew && (
						<button className="text-button popover-new-tag" onClick={() => setShowNew(true)}>
							<Plus {...iconSm} aria-hidden="true" />
							New tag
						</button>
					)}
					{showNew && (
						<form
							onSubmit={(e) => {
								e.preventDefault()
								if (name.trim()) apply({ tagId: newId }, { id: newId, name: name.trim(), color })
							}}
						>
							<label>
								<span className="popover-section-label">New tag</span>
								<input
									autoFocus
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Name"
								/>
							</label>
							<ColorChoices value={color} onChange={setColor} />
							<button className="popover-action" disabled={!name.trim()}>
								Create and apply
							</button>
						</form>
					)}
					{existing && (
						<button className="menu-button-danger" onClick={() => apply(null)}>
							Remove highlight
						</button>
					)}
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	)
}
