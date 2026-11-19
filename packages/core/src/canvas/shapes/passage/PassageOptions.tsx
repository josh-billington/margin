import * as Popover from '@radix-ui/react-popover'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { wordBindingMetadataSchema } from '@shared/study/types'
import { translationLockReason } from '../../../insertion/lock'
import { blockTitle } from '../../../insertion/labels'
import { TranslationControl } from './TranslationControl'
import { SliderField } from '../../../app/SliderField'
import type { PassageShape } from '../types'

export function PassageOptions({
	editor,
	shape,
	update,
	tagSelection,
	open,
	onOpenChange,
	children,
}: {
	editor: Editor
	shape: PassageShape
	update: (props: Partial<PassageShape['props']>) => void
	tagSelection: () => void
	open: boolean
	onOpenChange: (open: boolean) => void
	/** The header menu trigger; the panel anchors to it so there is one control, not two. */
	children: ReactNode
}) {
	// One undo step per drag: mark history when a drag starts, then update live as the text reflows.
	const sizing = useRef(false)
	const title = blockTitle(shape.props.text.ranges, shape.props.text.edition.translationId)
	const lockReason = useValue(
		'translation lock',
		() =>
			translationLockReason({
				highlights: shape.props.highlights.length,
				wordArrows: editor
					.getBindingsToShape(shape.id, 'arrow')
					.filter((binding) => wordBindingMetadataSchema.safeParse(binding.meta).success).length,
			}),
		[editor, shape.id, shape.props.highlights],
	)
	return (
		<Popover.Root open={open} onOpenChange={onOpenChange}>
			<Popover.Anchor asChild>
				<span className="passage-header-actions">{children}</span>
			</Popover.Anchor>
			<Popover.Portal>
				<Popover.Content
					className="margin-popover"
					aria-label={`Options for ${title}`}
					align="end"
					sideOffset={4}
					tabIndex={-1}
					// Focus the panel itself so no control wears a focus ring it did not ask for.
					onOpenAutoFocus={(e) => {
						e.preventDefault()
						;(e.currentTarget as HTMLElement | null)?.focus()
					}}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<TranslationControl editor={editor} shape={shape} lockReason={lockReason} />
					<label>
						Layout
						<select
							className="field"
							value={shape.props.layout}
							onChange={(e) =>
								update({ layout: e.target.value === 'flow' ? 'flow' : 'verse-per-line' })
							}
						>
							<option value="flow">Paragraphs</option>
							<option value="verse-per-line">One verse per line</option>
						</select>
					</label>
					<label>
						<input
							type="checkbox"
							checked={shape.props.showVerseNumbers}
							onChange={(e) => update({ showVerseNumbers: e.target.checked })}
						/>
						Verse numbers
					</label>
					<label>
						<input
							type="checkbox"
							checked={shape.props.showSuppliedWordItalics}
							onChange={(e) => update({ showSuppliedWordItalics: e.target.checked })}
						/>
						Italicize words added in translation
					</label>
					<SliderField
						label="Text size"
						value={shape.props.fontScale}
						format={(scale) => `${Math.round(scale * 100)}%`}
						min={0.6}
						max={2}
						step={0.1}
						onChange={(fontScale) => {
							if (!sizing.current) editor.markHistoryStoppingPoint('text size')
							sizing.current = true
							editor.updateShape({ id: shape.id, type: 'passage', props: { fontScale } })
						}}
						onCommit={() => {
							sizing.current = false
						}}
					/>
					<button className="popover-action" onClick={tagSelection}>
						Tag selected words
					</button>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	)
}
