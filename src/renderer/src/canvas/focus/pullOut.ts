import { createId } from '@shared/ids'
import type { VerseRef } from '@shared/bible/types'
import type { Highlight, PassageProps } from '@shared/study/types'
import { paintOf, verseKey, wordKey, words } from '../highlights/ranges'

export const PULL_OUT_SCALE = 1.4
export const MAX_FONT_SCALE = 4

/** Highlights clipped to one verse, with fresh IDs (SPEC §4.6). Tags are shared by ID. */
export function highlightsForVerse(
	source: PassageProps,
	verse: VerseRef,
	makeId = createId,
): Highlight[] {
	const all = words(source.text)
	const index = new Map(all.map((word, i) => [wordKey(word), i]))
	const inVerse = all.flatMap((word, i) => (verseKey(word.verse) === verseKey(verse) ? [i] : []))
	if (!inVerse.length) return []
	const lo = Math.min(...inVerse),
		hi = Math.max(...inVerse)
	const result: Highlight[] = []
	for (const highlight of source.highlights) {
		const start = index.get(wordKey(highlight.start)),
			end = index.get(wordKey(highlight.end))
		if (start === undefined || end === undefined || end < lo || start > hi) continue
		const from = all[Math.max(start, lo)],
			to = all[Math.min(end, hi)]
		if (from && to) result.push({ id: makeId(), ...paintOf(highlight), start: from, end: to })
	}
	return result
}

/** Props for a block holding just `verse` from the source snapshot; null if the verse is absent. */
export function pulledOutProps(
	source: PassageProps,
	sourceId: string,
	verse: VerseRef,
	makeId = createId,
): PassageProps | null {
	const found = source.text.verses.find((v) => verseKey(v.ref) === verseKey(verse))
	if (!found) return null
	return {
		...source,
		text: { ...source.text, ranges: [{ start: found.ref, end: found.ref }], verses: [found] },
		fontScale: Math.min(MAX_FONT_SCALE, source.fontScale * PULL_OUT_SCALE),
		highlights: highlightsForVerse(source, verse, makeId),
		pulledFrom: { passageId: sourceId, verse: found.ref },
	}
}
