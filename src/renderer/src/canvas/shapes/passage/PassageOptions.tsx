import * as Popover from '@radix-ui/react-popover'
import type { ReactNode } from 'react'
import { useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { wordBindingMetadataSchema } from '@shared/study/types'
import { translationLockReason } from '../../../insertion/lock'
import { blockTitle } from '../../../insertion/labels'
import { TranslationControl } from './TranslationControl'
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
							value={shape.props.layout}
							onChange={(e) =>
								update({ layout: e.target.value === 'flow' ? 'flow' : 'verse-per-line' })
							}
						>
							<option value="flow">Flow</option>
							<option value="verse-per-line">Verse per line</option>
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
						Supplied-word italics
					</label>
					<label>
						Scripture size
						<input
							type="range"
							min="0.6"
							max="2"
							step="0.1"
							value={shape.props.fontScale}
							onChange={(e) => update({ fontScale: Number(e.target.value) })}
						/>
					</label>
					<button className="popover-action" onClick={tagSelection}>
						Tag selected words
					</button>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	)
}
