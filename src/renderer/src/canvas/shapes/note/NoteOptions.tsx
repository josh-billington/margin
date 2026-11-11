import { Ellipsis } from 'lucide-react'
import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as Slider from '@radix-ui/react-slider'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { notePropsSchema } from '@shared/study/types'
import type { NoteProps } from '@shared/study/types'
import { blockNoun, blockTitle } from '../../../insertion/labels'
import { verseKey } from '../../highlights/ranges'
import { pagePassages } from '../../tags/tagOps'
import type { NoteShape } from '../types'
import { noteSizes } from './NoteShapeUtil'
import { iconLg } from '../../../lib/icons'

const degrees = (radians: number) => Math.round(((radians * 180) / Math.PI) * 2) / 2

export function NoteOptions({ editor, shape }: { editor: Editor; shape: NoteShape }) {
	const [rotation, setRotation] = useState(degrees(shape.rotation))
	const passages = useValue('passages', () => pagePassages(editor), [editor])
	const association = shape.props.association
	const linked = passages.find((p) => p.id === association?.passageId)
	const update = (props: Partial<NoteProps>) => {
		editor.markHistoryStoppingPoint('note options')
		editor.updateShape({ id: shape.id, type: shape.type, props })
	}
	const label = (passage: (typeof passages)[number]) => {
		return blockTitle(passage.props.text.ranges, passage.props.text.edition.translationId)
	}
	return (
		<Popover.Root onOpenChange={(open) => open && setRotation(degrees(shape.rotation))}>
			<Popover.Trigger
				aria-label="Note options"
				className="note-options-trigger"
				onPointerDown={(e) => e.stopPropagation()}
			>
				<Ellipsis {...iconLg} aria-hidden="true" />
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					className="margin-popover"
					onPointerDown={(e) => e.stopPropagation()}
					aria-label="Note options"
				>
					<div role="group" aria-label="Size">
						<span>Size</span>
						<ToggleGroup.Root
							type="single"
							className="toggle-row"
							value={shape.props.size}
							onValueChange={(size) =>
								size && update({ size: notePropsSchema.shape.size.parse(size) })
							}
						>
							{Object.keys(noteSizes).map((size) => (
								<ToggleGroup.Item key={size} value={size} aria-label={`Size ${size}`}>
									{size}
								</ToggleGroup.Item>
							))}
						</ToggleGroup.Root>
					</div>
					<div role="group" aria-label="Font">
						<span>Font</span>
						<ToggleGroup.Root
							type="single"
							className="toggle-row"
							value={shape.props.font}
							onValueChange={(font) =>
								font && update({ font: notePropsSchema.shape.font.parse(font) })
							}
						>
							<ToggleGroup.Item value="handwritten">Handwritten</ToggleGroup.Item>
							<ToggleGroup.Item value="plain">Plain</ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>
					<div role="group" aria-label="Color">
						<span>Color</span>
						<div className="color-choices">
							{notePropsSchema.shape.color.options.map((color) => (
								<button
									key={color}
									aria-label={color.charAt(0).toUpperCase() + color.slice(1)}
									aria-pressed={shape.props.color === color}
									style={{ background: `var(--${color === 'ink' ? 'pen' : color})` }}
									onClick={() => update({ color })}
								/>
							))}
						</div>
					</div>
					<label>
						Rotation: {rotation}°
						<Slider.Root
							className="slider-root"
							min={-6}
							max={6}
							step={0.5}
							value={[rotation]}
							onValueChange={([value]) => setRotation(value ?? 0)}
							onValueCommit={([value]) => {
								const target = ((value ?? 0) * Math.PI) / 180
								editor.markHistoryStoppingPoint('rotate note')
								editor.rotateShapesBy([shape.id], target - shape.rotation)
							}}
						>
							<Slider.Track className="slider-track">
								<Slider.Range className="slider-range" />
							</Slider.Track>
							<Slider.Thumb className="slider-thumb" aria-label="Rotation in degrees" />
						</Slider.Root>
					</label>
					<label>
						Keep with verses
						<select
							value={association?.passageId ?? ''}
							onChange={(e) =>
								update({ association: e.target.value ? { passageId: e.target.value } : undefined })
							}
						>
							<option value="">None</option>
							{passages.map((p) => (
								<option key={p.id} value={p.id}>
									{label(p)}
								</option>
							))}
						</select>
					</label>
					{linked && (
						<label>
							Verse
							<select
								value={association?.verse ? verseKey(association.verse) : ''}
								onChange={(e) => {
									const verse = linked.props.text.verses.find(
										(v) => verseKey(v.ref) === e.target.value,
									)?.ref
									update({ association: { passageId: linked.id, verse } })
								}}
							>
								<option value="">
									{blockNoun(linked.props.text.ranges, linked.props.text.edition.translationId) ===
									'chapter'
										? 'Whole chapter'
										: 'All verses'}
								</option>
								{linked.props.text.verses.map((v) => (
									<option key={verseKey(v.ref)} value={verseKey(v.ref)}>
										{v.ref.chapter}:{v.ref.verse}
									</option>
								))}
							</select>
						</label>
					)}
					<button
						className="popover-action"
						onClick={() => {
							editor.setEditingShape(shape.id)
							editor.select(shape.id)
						}}
					>
						Edit text
					</button>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	)
}
