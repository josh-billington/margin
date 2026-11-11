import { z } from 'zod'
import { books, findBooks } from './books'
import { passageRangeSchema, textEditionSchema, translationIdSchema } from './types'
import type { BookId, TranslationId } from './types'

export const referenceErrorSchema = z.object({
	kind: z.literal('error'),
	code: z.enum(['INVALID_SYNTAX', 'UNKNOWN_BOOK', 'AMBIGUOUS_BOOK', 'INVALID_RANGE']),
	message: z.string(),
	candidates: z.array(z.string()),
})
export const insertionPreviewSchema = z.union([
	z.object({
		kind: z.literal('resolved'),
		edition: textEditionSchema,
		ranges: z.array(passageRangeSchema).min(1),
		label: z.string(),
		translation: translationIdSchema,
		numberingSystem: z.string(),
		notice: z.string().nullable(),
	}),
	referenceErrorSchema,
])
export type ReferenceError = z.infer<typeof referenceErrorSchema>
export type InsertionPreview = z.infer<typeof insertionPreviewSchema>
export type VerseBoundaries = (
	translation: TranslationId,
	book: BookId,
	chapter: number,
) => readonly number[]

export function parseReference(
	reference: string,
	defaultTranslation: TranslationId,
	boundaries: VerseBoundaries,
	oldTestamentTranslation?: TranslationId,
) {
	const fail = (
		code: ReferenceError['code'],
		message: string,
		candidates: string[] = [],
	): ReferenceError => ({ kind: 'error', code, message, candidates })
	const qualifier = /^(KJV|JPS(?:\s*1917)?|BSB|WEB|ASV)\s+/i.exec(reference.trim())
	let translation: TranslationId = qualifier
		? /^jps/i.test(qualifier[1] ?? '')
			? 'jps1917'
			: translationIdSchema.parse(qualifier[1]?.toLowerCase())
		: defaultTranslation
	const input = reference.trim().slice(qualifier?.[0].length ?? 0)
	const match = /^(.*?)\s+(\d+)(?::(\d+))?(?:\s*[-–]\s*(?:(\d+):)?(\d+))?$/.exec(input)
	if (!match)
		return fail(
			'INVALID_SYNTAX',
			'Enter a book and chapter, optionally with a verse or range. Cross-book ranges are not supported.',
		)
	const candidates = findBooks(match[1] ?? '')
	if (!candidates.length)
		return fail(
			'UNKNOWN_BOOK',
			'Book name is not recognized.',
			books
				.filter((book) => book.name.toLowerCase().startsWith((match[1] ?? '').toLowerCase()))
				.map((book) => book.name),
		)
	if (candidates.length !== 1)
		return fail(
			'AMBIGUOUS_BOOK',
			'Choose a book.',
			candidates.map((book) => book.name),
		)
	const book = candidates[0]
	if (!book) return fail('UNKNOWN_BOOK', 'Book name is not recognized.')
	// An unqualified Old Testament reference uses the separate OT default when one is set.
	if (!qualifier && book.testament === 'old' && oldTestamentTranslation)
		translation = oldTestamentTranslation
	const notice =
		translation === 'jps1917' && book.testament === 'new'
			? 'JPS 1917 contains the Tanakh only. KJV is offered for this New Testament reference; confirm KJV before adding.'
			: null
	if (notice) translation = 'kjv'
	const startChapter = Number(match[2])
	const startVerses = boundaries(translation, book.id, startChapter)
	const endChapter = match[4] ? Number(match[4]) : startChapter
	const endVerses = boundaries(translation, book.id, endChapter)
	const startVerse = match[3] ? Number(match[3]) : startVerses[0]
	const endVerse = match[5] ? Number(match[5]) : match[3] ? startVerse : endVerses.at(-1)
	if (
		(!match[3] && match[5]) ||
		startVerse === undefined ||
		endVerse === undefined ||
		!startVerses.includes(startVerse) ||
		!endVerses.includes(endVerse) ||
		endChapter < startChapter ||
		(endChapter === startChapter && endVerse < startVerse)
	)
		return fail('INVALID_RANGE', 'That chapter or verse range does not exist in this edition.')
	for (let chapter = startChapter; chapter <= endChapter; chapter++) {
		if (!boundaries(translation, book.id, chapter).length)
			return fail('INVALID_RANGE', 'The range includes a missing chapter.')
	}
	const range = {
		start: { book: book.id, chapter: startChapter, verse: startVerse },
		end: { book: book.id, chapter: endChapter, verse: endVerse },
	}
	const label = `${book.name} ${startChapter}:${startVerse}${startChapter !== endChapter ? `–${endChapter}:${endVerse}` : startVerse !== endVerse ? `–${endVerse}` : ''}`
	return { kind: 'resolved' as const, ranges: [range], label, translation, notice }
}
