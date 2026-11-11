import './tags.css'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Tags } from 'lucide-react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Popover from '@radix-ui/react-popover'
import { useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { toast } from 'sonner'
import type { PaletteColor, Tag } from '@shared/study/types'
import { countHighlightRanges } from '@shared/study/tags'
import { pageTags } from '../canvas/highlights/TagPopover'
import {
	addStarterTags,
	createTag,
	deleteTag,
	pagePassages,
	updateTag,
} from '../canvas/tags/tagOps'
import {
	clearTagFocus,
	selectTag,
	stepTagMatch,
	tagMatches,
	useTagFocus,
} from '../canvas/tags/tagFocus'
import { iconMd, iconSm } from '../lib/icons'
import { ColorChoices } from './ColorChoices'

function EditTag({
	editor,
	tag,
	count,
	onDelete,
}: {
	editor: Editor
	tag: Tag
	count: number
	onDelete: () => void
}) {
	const [name, setName] = useState(tag.name)
	return (
		<Popover.Root onOpenChange={(open) => open && setName(tag.name)}>
			<Popover.Trigger asChild>
				<button className="row-icon-button" aria-label={`Edit tag ${tag.name}`}>
					<Pencil {...iconSm} aria-hidden="true" />
				</button>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content className="margin-popover" aria-label={`Edit tag ${tag.name}`}>
					<form
						onSubmit={(e) => {
							e.preventDefault()
							if (name.trim() && name.trim() !== tag.name) updateTag(editor, tag.id, { name })
						}}
					>
						<label>
							Name
							<input
								className="field"
								value={name}
								onChange={(e) => setName(e.target.value)}
								onBlur={() =>
									name.trim() && name.trim() !== tag.name && updateTag(editor, tag.id, { name })
								}
							/>
						</label>
					</form>
					<ColorChoices
						value={tag.color}
						onChange={(color) => updateTag(editor, tag.id, { color })}
					/>
					<button className="menu-button menu-button-danger" onClick={onDelete}>
						{count ? 'Delete tag…' : 'Delete tag'}
					</button>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	)
}

function DeleteTagDialog({
	editor,
	tag,
	count,
	others,
	onClose,
}: {
	editor: Editor
	tag: Tag
	count: number
	others: Tag[]
	onClose: () => void
}) {
	const [mode, setMode] = useState<'remove' | 'reassign'>(others.length ? 'reassign' : 'remove')
	const [target, setTarget] = useState(others[0]?.id ?? '')
	return (
		<AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
			<AlertDialog.Portal>
				<AlertDialog.Overlay className="dialog-overlay" />
				<AlertDialog.Content className="dialog-panel">
					<AlertDialog.Title>Delete “{tag.name}”?</AlertDialog.Title>
					<AlertDialog.Description>
						{count === 1 ? '1 highlight uses' : `${count} highlights use`} this tag. You can undo
						this.
					</AlertDialog.Description>
					<label>
						<span>
							<input
								type="radio"
								checked={mode === 'reassign'}
								disabled={!others.length}
								onChange={() => setMode('reassign')}
							/>{' '}
							Move highlights to another tag
						</span>
						<select
							className="field"
							value={target}
							disabled={mode !== 'reassign'}
							onChange={(e) => setTarget(e.target.value)}
							aria-label="Reassign to"
						>
							{others.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>
							<input type="radio" checked={mode === 'remove'} onChange={() => setMode('remove')} />{' '}
							Remove the highlights
						</span>
					</label>
					<div className="dialog-actions">
						<AlertDialog.Cancel asChild>
							<button className="button">Cancel</button>
						</AlertDialog.Cancel>
						<AlertDialog.Action asChild>
							<button
								className="button button-danger"
								onClick={() => {
									deleteTag(editor, tag.id, mode === 'reassign' ? target : null)
									onClose()
								}}
							>
								Delete tag
							</button>
						</AlertDialog.Action>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	)
}

export function TagsSection({ editor }: { editor: Editor | null }) {
	const tags = useValue('sidebar tags', () => (editor ? pageTags(editor) : []), [editor])
	const counts = useValue(
		'tag counts',
		() => (editor ? countHighlightRanges(pagePassages(editor).map((p) => p.props.highlights)) : {}),
		[editor],
	)
	const selected = useTagFocus((state) => state.tagId)
	const index = useTagFocus((state) => state.index)
	const [pendingDelete, setPendingDelete] = useState<Tag | null>(null)
	const [name, setName] = useState('')
	const [color, setColor] = useState<PaletteColor>('sky')
	const matchCount = useValue(
		'tag matches',
		() => (editor && selected ? tagMatches(editor, selected).length : 0),
		[editor, selected],
	)
	useEffect(() => {
		if (editor && selected && !tags.some((t) => t.id === selected)) clearTagFocus()
	}, [editor, selected, tags])
	const readOnly = !editor || editor.getIsReadonly()
	return (
		<section aria-labelledby="tags-heading">
			<div className="section-heading">
				<h2 id="tags-heading">Tags</h2>
			</div>
			<ul className="tag-list">
				{tags.map((tag) => (
					<li key={tag.id} className="tag-row" aria-current={selected === tag.id}>
						<button
							className="row-button tag-pick"
							aria-pressed={selected === tag.id}
							aria-label={`${tag.name}, ${counts[tag.id] ?? 0} highlights. Show matches`}
							onClick={() => {
								selectTag(tag.id)
								if (editor && tag.id !== selected) stepTagMatch(editor, 1)
							}}
						>
							<span
								className="tag-swatch"
								style={{ background: `var(--${tag.color})` }}
								aria-hidden="true"
							/>
							<span className="tag-name">{tag.name}</span>
							<span className="tag-count">{counts[tag.id] ?? 0}</span>
						</button>
						{editor && !readOnly && (
							<EditTag
								editor={editor}
								tag={tag}
								count={counts[tag.id] ?? 0}
								onDelete={() => {
									if (counts[tag.id]) setPendingDelete(tag)
									else deleteTag(editor, tag.id, null)
								}}
							/>
						)}
					</li>
				))}
			</ul>
			{editor && selected && (
				<div className="tag-nav" role="group" aria-label="Tag matches">
					<button
						className="row-icon-button"
						aria-label="Previous match"
						disabled={!matchCount}
						onClick={() => stepTagMatch(editor, -1)}
					>
						<ChevronLeft {...iconSm} />
					</button>
					<span aria-live="polite">
						{matchCount ? `${index < 0 ? '–' : index + 1} of ${matchCount}` : 'No matches'}
					</span>
					<button
						className="row-icon-button"
						aria-label="Next match"
						disabled={!matchCount}
						onClick={() => stepTagMatch(editor, 1)}
					>
						<ChevronRight {...iconSm} />
					</button>
				</div>
			)}
			{editor && !readOnly && (
				<>
					<Popover.Root>
						<Popover.Trigger asChild>
							<button className="row-button row-action">
								<Plus {...iconMd} aria-hidden="true" /> New tag
							</button>
						</Popover.Trigger>
						<Popover.Portal>
							<Popover.Content className="margin-popover" aria-label="New tag">
								<form
									onSubmit={(e) => {
										e.preventDefault()
										if (!name.trim()) return
										createTag(editor, name, color)
										setName('')
									}}
								>
									<label>
										Name
										<input
											className="field"
											autoFocus
											value={name}
											onChange={(e) => setName(e.target.value)}
										/>
									</label>
									<ColorChoices value={color} onChange={setColor} />
									<button className="button button-primary" disabled={!name.trim()}>
										Create tag
									</button>
								</form>
							</Popover.Content>
						</Popover.Portal>
					</Popover.Root>
					{tags.length === 0 && (
						<button
							className="row-button row-action"
							onClick={() => {
								const added = addStarterTags(editor)
								toast.info(
									added ? `Added ${added} starter tags.` : 'Starter tags are already here.',
								)
							}}
						>
							<Tags {...iconMd} aria-hidden="true" /> Add starter tags
						</button>
					)}
				</>
			)}
			{editor && pendingDelete && (
				<DeleteTagDialog
					editor={editor}
					tag={pendingDelete}
					count={counts[pendingDelete.id] ?? 0}
					others={tags.filter((t) => t.id !== pendingDelete.id)}
					onClose={() => setPendingDelete(null)}
				/>
			)}
		</section>
	)
}
