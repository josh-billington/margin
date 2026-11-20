import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
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
import { NewTagForm } from '../../app/NewTagForm'
import { iconMd, iconSm } from '../../lib/icons'
import { usePopoverMotion } from '../../app/popoverMotion'

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

/** Up and Down step through the popover's rows, as in a menu; the name field keeps its own keys. */
function stepRows(event: KeyboardEvent<HTMLDivElement>) {
	const down = event.key === 'ArrowDown'
	if ((!down && event.key !== 'ArrowUp') || event.target instanceof HTMLInputElement) return
	const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('.popover-row')]
	if (!rows.length) return
	event.preventDefault()
	const at = rows.findIndex((row) => row === document.activeElement)
	const next =
		at < 0 ? (down ? 0 : rows.length - 1) : (at + (down ? 1 : -1) + rows.length) % rows.length
	rows[next]?.focus()
}

/**
 * Highlight and tag popover, laid out like a macOS menu: the plain highlight colours in one row, the
 * study's tags to apply with one click or tap, "New tag…" opening the name field in place, and
 * Remove highlight set apart at the bottom.
 */
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
	const liveTags = useValue('tags', () => pageTags(editor), [editor])
	const liveExisting = shape.props.highlights.find(
		(h) => wordKey(h.start) === wordKey(range.start) && wordKey(h.end) === wordKey(range.end),
	)
	// While it leaves, it keeps showing what it showed: applying a tag must not reflow it as it goes.
	const [frozen, setFrozen] = useState<{
		range: typeof range
		tags: Tag[]
		existing: typeof liveExisting
	} | null>(null)
	const { tags, existing } =
		frozen?.range === range ? frozen : { tags: liveTags, existing: liveExisting }
	const [creating, setCreating] = useState(false)
	const newId = useMemo(() => ulid(), [])
	// Opening focuses the current tag (or the first, or New tag…), as a menu does, never a swatch.
	const focusTagId = tags.some((tag) => tag.id === existing?.tagId) ? existing?.tagId : tags[0]?.id
	const firstRow = useRef<HTMLButtonElement>(null)
	const newTagRow = useRef<HTMLButtonElement>(null)
	const collapsedByKey = useRef(false)
	useEffect(() => {
		if (creating || !collapsedByKey.current) return
		collapsedByKey.current = false
		newTagRow.current?.focus()
	}, [creating])
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
	const motion = usePopoverMotion({
		request: range,
		target: `${wordKey(range.start)} ${wordKey(range.end)}`,
		origin: () => ({ anchor: rectOf.current(), point: { x: range.x, y: range.y } }),
		close,
		freeze: () => setFrozen({ range, tags, existing }),
	})
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
		motion.requestClose()
	}
	const recolour = (color: PaletteColor) => {
		setHighlightColor(color)
		apply({ color })
	}
	return (
		<Popover.Root
			open
			onOpenChange={(open) => {
				if (!open) motion.requestClose()
			}}
		>
			{/* A virtual anchor: a fixed element inside the transformed shape would be offset by the camera. */}
			<Popover.Anchor virtualRef={anchor} />
			<Popover.Portal>
				<Popover.Content
					{...motion.contentProps}
					className="margin-popover tag-popover"
					side="bottom"
					align="start"
					sideOffset={8}
					collisionPadding={collisionPadding}
					onPointerDown={(e) => e.stopPropagation()}
					onKeyDown={stepRows}
					onOpenAutoFocus={(e) => {
						e.preventDefault()
						;(firstRow.current ?? newTagRow.current)?.focus()
					}}
					// Escape first folds the name field back into its row; the next one closes.
					onEscapeKeyDown={(e) => {
						if (!creating) return
						e.preventDefault()
						collapsedByKey.current = true
						setCreating(false)
					}}
					aria-label={existing ? 'Highlight' : 'Tag selected words'}
				>
					<ColorChoices
						label="Highlight colour"
						value={existing?.color ?? null}
						onChange={recolour}
					/>
					<hr />
					{tags.length > 0 && (
						<div className="popover-tags" role="group" aria-label="Tags">
							{tags.map((tag) => (
								<button
									key={tag.id}
									ref={tag.id === focusTagId ? firstRow : undefined}
									className="popover-row"
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
					{creating ? (
						<NewTagForm
							layout="compact"
							submitLabel="Add"
							onCreate={(name, color) => apply({ tagId: newId }, { id: newId, name, color })}
						/>
					) : (
						<button ref={newTagRow} className="popover-row" onClick={() => setCreating(true)}>
							<Plus {...iconMd} aria-hidden="true" />
							New tag…
						</button>
					)}
					{existing && (
						<>
							<hr />
							<button className="popover-row popover-row-danger" onClick={() => apply(null)}>
								Remove highlight
							</button>
						</>
					)}
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	)
}
