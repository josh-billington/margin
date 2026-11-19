import { books } from '@shared/bible/books'
import { chapterLastVerses } from '@shared/bible/chapterVerses'
import { translationNames } from '@shared/bible/translationNames'
import type { PassageRange, TranslationId, VerseRef } from '@shared/bible/types'

export { translationNames }

/**
 * The one order for translation lists everywhere: KJV (the default), the modern English
 * translations, then JPS 1917, which covers only the Old Testament. Compact controls use the short
 * names; first-run setup, where a reader may not know the abbreviations, uses the long ones.
 */
export const translationOrder = [
	'kjv',
	'bsb',
	'web',
	'asv',
	'jps1917',
] as const satisfies readonly TranslationId[]
/** Translations that cover the whole Bible, for a default that has to work for any reference. */
export const wholeBibleTranslations = translationOrder.filter((id) => id !== 'jps1917')

const bookName = (id: string) => books.find((book) => book.id === id)?.name ?? id
const verseLabel = (ref: VerseRef) => `${ref.chapter}:${ref.verse}`

export function formatRange({ start, end }: PassageRange): string {
	const same = start.chapter === end.chapter
	const tail = same ? (start.verse === end.verse ? '' : `–${end.verse}`) : `–${verseLabel(end)}`
	return `${bookName(start.book)} ${verseLabel(start)}${tail}`
}

export const formatRanges = (ranges: readonly PassageRange[]) => ranges.map(formatRange).join(', ')

export type BlockNoun = 'verse' | 'verses' | 'chapter' | 'chapters'

/** A range from verse 1 of a chapter to the last verse of the same or a later chapter in the same book. */
function coversWholeChapters({ start, end }: PassageRange, translation: TranslationId) {
	const last = chapterLastVerses[translation][end.book]?.[end.chapter - 1]
	return start.verse === 1 && last !== undefined && end.verse === last
}

/** The noun for what a block holds: whole chapters read as chapter(s), anything else as verse(s). */
export function blockNoun(ranges: readonly PassageRange[], translation: TranslationId): BlockNoun {
	if (ranges.length > 0 && ranges.every((range) => coversWholeChapters(range, translation))) {
		const chapters = ranges.reduce(
			(sum, { start, end }) => sum + end.chapter - start.chapter + 1,
			0,
		)
		return chapters === 1 ? 'chapter' : 'chapters'
	}
	const [only] = ranges
	return ranges.length === 1 && only && verseLabel(only.start) === verseLabel(only.end)
		? 'verse'
		: 'verses'
}

/** "Amos 1:3–5", or "Amos 1" / "Amos 1–3" when the range is whole chapters. */
export function formatBlockRange(range: PassageRange, translation: TranslationId): string {
	if (!coversWholeChapters(range, translation)) return formatRange(range)
	const { start, end } = range
	return `${bookName(start.book)} ${start.chapter}${end.chapter === start.chapter ? '' : `–${end.chapter}`}`
}

export const formatBlockRanges = (ranges: readonly PassageRange[], translation: TranslationId) =>
	ranges.map((range) => formatBlockRange(range, translation)).join(', ')

/** Label for a block: reference, then the short translation name ("Amos 1:3–5 · JPS 1917"). */
export const blockTitle = (ranges: readonly PassageRange[], translation: TranslationId) =>
	`${formatBlockRanges(ranges, translation)} · ${translationNames[translation].short}`
