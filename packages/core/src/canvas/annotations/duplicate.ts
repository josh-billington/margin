import { createId } from '@shared/ids'
import type { Highlight, NoteProps } from '@shared/study/types'

/** Fresh highlight IDs; tag IDs and ranges are reused (SPEC §4.6). */
export const remapHighlightIds = (
	highlights: readonly Highlight[],
	makeId = createId,
): Highlight[] => highlights.map((h) => ({ ...h, id: makeId() }))

/**
 * Pairs original and duplicate shape IDs. tldraw selects duplicates in input order;
 * a length or type mismatch means no safe pairing exists.
 */
export function pairDuplicates(
	originals: readonly { id: string; type: string }[],
	duplicates: readonly { id: string; type: string }[],
): Map<string, string> | undefined {
	if (originals.length !== duplicates.length) return undefined
	const map = new Map<string, string>()
	for (const [i, original] of originals.entries()) {
		const duplicate = duplicates[i]
		if (!duplicate || duplicate.type !== original.type) return undefined
		map.set(original.id, duplicate.id)
	}
	return map
}

/** A duplicated note follows its passage only when that passage was duplicated too. */
export function remapAssociation(
	association: NoteProps['association'],
	idMap: ReadonlyMap<string, string>,
): NoteProps['association'] {
	if (!association) return association
	const passageId = idMap.get(association.passageId)
	return passageId ? { ...association, passageId } : association
}
