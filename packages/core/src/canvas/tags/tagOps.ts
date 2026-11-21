import type { Editor } from 'tldraw'
import { createId } from '@shared/ids'
import { starterTags } from '@shared/study/tags'
import type { Highlight, PaletteColor, Tag } from '@shared/study/types'
import { retagHighlights } from '../highlights/ranges'
import { pageTags } from '../highlights/TagPopover'
import { replaceRange } from '../highlights/ranges'
import type { PassageShape } from '../shapes/types'

export const pagePassages = (editor: Editor): PassageShape[] =>
	editor.getCurrentPageShapes().filter((s): s is PassageShape => s.type === 'passage')

export function writeTags(editor: Editor, tags: Tag[]) {
	editor.updatePage({
		id: editor.getCurrentPageId(),
		meta: { ...editor.getCurrentPage().meta, schemaVersion: 1, tags },
	})
}
const edit = (editor: Editor, label: string, change: () => void) => {
	editor.markHistoryStoppingPoint(label)
	editor.run(change)
}

export function createTag(editor: Editor, name: string, color: PaletteColor) {
	const tag = { id: createId(), name: name.trim(), color }
	if (tag.name) edit(editor, 'create tag', () => writeTags(editor, [...pageTags(editor), tag]))
	return tag
}
export function updateTag(editor: Editor, id: string, patch: Partial<Pick<Tag, 'name' | 'color'>>) {
	const name = patch.name?.trim()
	if (patch.name !== undefined && !name) return
	edit(editor, 'edit tag', () =>
		writeTags(
			editor,
			pageTags(editor).map((t) =>
				t.id === id ? { ...t, ...patch, ...(name ? { name } : {}) } : t,
			),
		),
	)
}
/** Adds starter tags that are not already present; never applied to text. */
export function addStarterTags(editor: Editor) {
	const tags = pageTags(editor)
	const missing = starterTags.filter(
		(s) => !tags.some((t) => t.name.toLowerCase() === s.name.toLowerCase()),
	)
	if (!missing.length) return 0
	edit(editor, 'add starter tags', () =>
		writeTags(editor, [...tags, ...missing.map((s) => ({ id: createId(), ...s }))]),
	)
	return missing.length
}

/** Deleting a tag: reassign its highlights to another tag, or remove them. One undo step. */
export function deleteTag(editor: Editor, id: string, reassignTo: string | null) {
	edit(editor, 'delete tag', () => {
		for (const passage of pagePassages(editor)) {
			if (!passage.props.highlights.some((h) => h.tagId === id)) continue
			editor.updateShape({
				id: passage.id,
				type: 'passage',
				props: {
					highlights: retagHighlights(passage.props.text, passage.props.highlights, id, reassignTo),
				},
			})
		}
		writeTags(
			editor,
			pageTags(editor).filter((t) => t.id !== id),
		)
	})
}

export function removeHighlight(editor: Editor, passage: PassageShape, highlight: Highlight) {
	const current = editor.getShape(passage.id)
	if (current?.type !== 'passage') return
	edit(editor, 'remove highlight', () =>
		editor.updateShape({
			id: passage.id,
			type: 'passage',
			props: {
				highlights: replaceRange(
					current.props.text,
					current.props.highlights,
					highlight.start,
					highlight.end,
					null,
				),
			},
		}),
	)
}
