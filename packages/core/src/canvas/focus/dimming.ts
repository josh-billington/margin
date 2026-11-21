import type { VerseRef } from '@shared/bible/types'

/** What reading focus is on. Verse focus implies its passage. */
export type FocusTarget =
	{ level: 'passage'; passageId: string } | { level: 'verse'; passageId: string; verse: VerseRef }

export interface DimModel {
	notes: readonly { id: string; association?: { passageId: string; verse?: VerseRef } }[]
	/** Each arrow's bound shapes; `verse` is present for word-bound ends on a passage. */
	arrows: readonly { id: string; ends: readonly { toId: string; verse?: VerseRef }[] }[]
}

const sameVerse = (a: VerseRef | undefined, b: VerseRef) =>
	!!a && a.book === b.book && a.chapter === b.chapter && a.verse === b.verse

/**
 * SPEC §5.2. Returns the shape IDs that stay bright. Brightness never propagates: a
 * bright arrow does not brighten whatever sits at its far end unless that is a bright note.
 */
export function computeBrightSet(model: DimModel, focus: FocusTarget): Set<string> {
	const bright = new Set<string>([focus.passageId])
	const touchesFocus = (end: { toId: string; verse?: VerseRef }) =>
		end.toId === focus.passageId && (focus.level === 'passage' || sameVerse(end.verse, focus.verse))
	const noteIds = new Set(model.notes.map((note) => note.id))
	for (const note of model.notes) {
		const a = note.association
		if (
			a?.passageId === focus.passageId &&
			(focus.level === 'passage' || !a.verse || sameVerse(a.verse, focus.verse))
		)
			bright.add(note.id)
	}
	for (const arrow of model.arrows) {
		if (!arrow.ends.some(touchesFocus)) continue
		bright.add(arrow.id)
		for (const end of arrow.ends) if (noteIds.has(end.toId)) bright.add(end.toId)
	}
	// A bright note keeps its own direct arrows bright (its far end is not brightened).
	for (const arrow of model.arrows)
		if (arrow.ends.some((end) => noteIds.has(end.toId) && bright.has(end.toId)))
			bright.add(arrow.id)
	return bright
}
