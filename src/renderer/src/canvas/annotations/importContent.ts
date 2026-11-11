import { createId } from '@shared/ids'
import { mergeImportedTags, referencedTagIds } from '@shared/study/tags'
import type { Highlight, Tag } from '@shared/study/types'
import { remapHighlightIds } from './duplicate'

interface PassageLike {
	type: string
	props: { highlights?: Highlight[] } & Record<string, unknown>
}

/**
 * Prepares copied shapes for pasting: references tags in the destination catalog, importing
 * missing ones, and gives pasted highlights fresh IDs. Mutates nothing.
 */
export function prepareImport<S extends PassageLike>(
	shapes: readonly S[],
	sourceTags: readonly Tag[],
	destinationTags: readonly Tag[],
	makeId: () => string = createId,
) {
	const highlightLists = shapes
		.filter((s) => s.type === 'passage')
		.map((s) => s.props.highlights ?? [])
	const known = new Map(sourceTags.map((t) => [t.id, t]))
	// A highlight whose tag is absent from the clipboard payload cannot be named; keep it visible.
	const incoming = referencedTagIds(highlightLists).map(
		(id) => known.get(id) ?? { id, name: 'Imported tag', color: 'sky' as const },
	)
	const { tags, idMap, added } = mergeImportedTags(destinationTags, incoming, makeId)
	const mapped = shapes.map((shape) => {
		if (shape.type !== 'passage') return shape
		const highlights = remapHighlightIds(shape.props.highlights ?? [], makeId).map((h) => ({
			...h,
			...(h.tagId ? { tagId: idMap[h.tagId] ?? h.tagId } : {}),
		}))
		return { ...shape, props: { ...shape.props, highlights } }
	})
	return { shapes: mapped, tags, added }
}
