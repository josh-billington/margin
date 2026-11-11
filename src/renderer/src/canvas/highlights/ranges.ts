import { ulid } from 'ulid'
import type { PassageText, VerseRef } from '@shared/bible/types'
import type { Highlight, PaletteColor, WordTarget } from '@shared/study/types'

/** What a highlight is painted with: a tag, or a plain colour. */
export type Paint = { tagId: string } | { color: PaletteColor }
export const paintOf = (h: Pick<Highlight, 'tagId' | 'color'>): Paint =>
	h.tagId ? { tagId: h.tagId } : { color: h.color ?? 'amber' }
export const samePaint = (a: Paint, b: Paint) =>
	'tagId' in a ? 'tagId' in b && a.tagId === b.tagId : 'color' in b && a.color === b.color
type Span = { lo: number; hi: number; paint: Paint; id: string }

export const verseKey = (ref: VerseRef) => `${ref.book}.${ref.chapter}.${ref.verse}`
export const wordKey = (word: WordTarget) => `${verseKey(word.verse)}:${word.token}`
export function words(text: PassageText): WordTarget[] {
	return text.verses.flatMap((verse) =>
		verse.tokens.map((token) => ({ verse: verse.ref, token: token.i })),
	)
}
export function wordIndex(text: PassageText, target: WordTarget): number {
	return words(text).findIndex((word) => wordKey(word) === wordKey(target))
}
export function highlightAt(text: PassageText, highlights: Highlight[], target: WordTarget) {
	const index = wordIndex(text, target)
	return highlights.find(
		(h) => index >= wordIndex(text, h.start) && index <= wordIndex(text, h.end),
	)
}

/** Inclusive replacement in snapshot order; null removes only the selected range. */
export function replaceRange(
	text: PassageText,
	highlights: Highlight[],
	start: WordTarget,
	end: WordTarget,
	paint: Paint | null,
): Highlight[] {
	const all = words(text)
	const index = new Map(all.map((word, i) => [wordKey(word), i]))
	const a = index.get(wordKey(start)),
		b = index.get(wordKey(end))
	if (a === undefined || b === undefined)
		throw new Error('Range target is absent from scripture snapshot')
	const lo = Math.min(a, b),
		hi = Math.max(a, b)
	const ranges: Span[] = []
	for (const h of highlights) {
		const left = index.get(wordKey(h.start)),
			right = index.get(wordKey(h.end))
		if (left === undefined || right === undefined || left > right)
			throw new Error('Invalid stored highlight')
		if (right < lo || left > hi) ranges.push({ lo: left, hi: right, paint: paintOf(h), id: h.id })
		else {
			if (left < lo) ranges.push({ lo: left, hi: lo - 1, paint: paintOf(h), id: h.id })
			if (right > hi)
				ranges.push({ lo: hi + 1, hi: right, paint: paintOf(h), id: left < lo ? ulid() : h.id })
		}
	}
	if (paint) ranges.push({ lo, hi, paint, id: ulid() })
	ranges.sort((x, y) => x.lo - y.lo)
	const merged: typeof ranges = []
	for (const range of ranges) {
		const previous = merged.at(-1)
		if (previous && previous.hi + 1 === range.lo && samePaint(previous.paint, range.paint))
			previous.hi = range.hi
		else merged.push({ ...range })
	}
	return merged.map((range) => {
		const start = all[range.lo],
			end = all[range.hi]
		if (!start || !end) throw new Error('Invalid highlight bounds')
		return { id: range.id, ...range.paint, start, end }
	})
}

/** Moves every highlight of one tag to another (or removes them), merging newly adjacent ranges. */
export function retagHighlights(
	text: PassageText,
	highlights: Highlight[],
	fromTagId: string,
	toTagId: string | null,
): Highlight[] {
	const all = words(text)
	const index = new Map(all.map((word, i) => [wordKey(word), i]))
	const ranges: Span[] = []
	for (const h of highlights) {
		const lo = index.get(wordKey(h.start)),
			hi = index.get(wordKey(h.end))
		if (lo === undefined || hi === undefined || lo > hi) throw new Error('Invalid stored highlight')
		if (h.tagId !== fromTagId) ranges.push({ lo, hi, paint: paintOf(h), id: h.id })
		else if (toTagId) ranges.push({ lo, hi, paint: { tagId: toTagId }, id: h.id })
	}
	ranges.sort((x, y) => x.lo - y.lo)
	const merged: typeof ranges = []
	for (const range of ranges) {
		const previous = merged.at(-1)
		if (previous && previous.hi + 1 === range.lo && samePaint(previous.paint, range.paint))
			previous.hi = range.hi
		else merged.push({ ...range })
	}
	return merged.map((range) => {
		const start = all[range.lo],
			end = all[range.hi]
		if (!start || !end) throw new Error('Invalid highlight bounds')
		return { id: range.id, ...range.paint, start, end }
	})
}

/** Matches of one tag in reading order: top-to-bottom, left-to-right passages, then word order. */
export function orderTagMatches(
	passages: { id: string; x: number; y: number; text: PassageText; highlights: Highlight[] }[],
	tagId: string,
) {
	return [...passages]
		.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
		.flatMap((passage) =>
			passage.highlights
				.filter((h) => h.tagId === tagId)
				.map((highlight) => ({ passage, highlight, at: wordIndex(passage.text, highlight.start) }))
				.sort((a, b) => a.at - b.at)
				.map(({ passage, highlight }) => ({ passageId: passage.id, highlight })),
		)
}
