import { createId } from '../ids'
import type { Highlight, PaletteColor, Tag } from './types'

export const starterTags: { name: string; color: PaletteColor }[] = [
	{ name: 'Place', color: 'sky' },
	{ name: 'Person', color: 'violet' },
	{ name: 'Repeated word', color: 'rose' },
	{ name: 'Judgement', color: 'coral' },
	{ name: 'Promise', color: 'amber' },
	{ name: 'Command', color: 'green' },
]

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export interface TagImport {
	/** Destination catalog after the import. */
	tags: Tag[]
	/** Source tag ID -> destination tag ID. */
	idMap: Record<string, string>
	added: Tag[]
}

/**
 * Imports tags from another study. An existing tag is reused only when name and color
 * both match. An ID collision with a different tag never replaces the destination tag.
 */
export function mergeImportedTags(
	existing: readonly Tag[],
	incoming: readonly Tag[],
	makeId: () => string = createId,
): TagImport {
	const tags = [...existing]
	const idMap: Record<string, string> = {}
	const added: Tag[] = []
	for (const tag of incoming) {
		if (tag.id in idMap) continue
		const match = tags.find((t) => t.color === tag.color && sameName(t.name, tag.name))
		if (match) {
			idMap[tag.id] = match.id
			continue
		}
		const id = tags.some((t) => t.id === tag.id) ? makeId() : tag.id
		const imported = { ...tag, id }
		tags.push(imported)
		added.push(imported)
		idMap[tag.id] = id
	}
	return { tags, idMap, added }
}

/** Number of highlight ranges per tag (plain highlights are not counted) across the supplied passages. */
export function countHighlightRanges(highlightLists: readonly (readonly Highlight[])[]) {
	const counts: Record<string, number> = {}
	for (const list of highlightLists)
		for (const { tagId } of list) if (tagId) counts[tagId] = (counts[tagId] ?? 0) + 1
	return counts
}

export const referencedTagIds = (highlightLists: readonly (readonly Highlight[])[]) => [
	...new Set(highlightLists.flatMap((list) => list.flatMap((h) => (h.tagId ? [h.tagId] : [])))),
]
