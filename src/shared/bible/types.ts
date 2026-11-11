import { z } from 'zod'
import { books } from './books'

export const translationIdSchema = z.enum(['kjv', 'jps1917', 'bsb', 'web', 'asv'])
export type TranslationId = z.infer<typeof translationIdSchema>

export const bookIdSchema = z.enum(books.map((book) => book.id))
export type BookId = z.infer<typeof bookIdSchema>
export const verseRefSchema = z.object({
	book: bookIdSchema,
	chapter: z.number().int().positive(),
	verse: z.number().int().nonnegative(), // Some editions number psalm superscriptions as verse 0.
})
export type VerseRef = z.infer<typeof verseRefSchema>
export const passageRangeSchema = z
	.object({ start: verseRefSchema, end: verseRefSchema })
	.refine(({ start, end }) => start.book === end.book, 'Ranges cannot cross book boundaries')
	.refine(
		({ start, end }) =>
			start.chapter < end.chapter || (start.chapter === end.chapter && start.verse <= end.verse),
		'Range end must follow its start',
	)
export type PassageRange = z.infer<typeof passageRangeSchema>
export const textEditionSchema = z.object({
	translationId: translationIdSchema,
	editionName: z.string().min(1),
	versificationId: z.string().min(1),
	corpusRevision: z.string().min(1),
	tokenizerVersion: z.string().min(1),
})
export type TextEdition = z.infer<typeof textEditionSchema>
export const tokenSchema = z.object({
	i: z.number().int().nonnegative(),
	leading: z.string(),
	runs: z.array(z.object({ text: z.string(), italic: z.boolean() })),
	trailing: z.string(),
	spaceAfter: z.string(),
})
export type Token = z.infer<typeof tokenSchema>
export const verseSchema = z.object({
	ref: verseRefSchema,
	paragraphBreakBefore: z.boolean(),
	tokens: z.array(tokenSchema),
})
export type Verse = z.infer<typeof verseSchema>
export const passageTextSchema = z.object({
	edition: textEditionSchema,
	ranges: z.array(passageRangeSchema).min(1),
	verses: z.array(verseSchema),
})
export type PassageText = z.infer<typeof passageTextSchema>

export interface BibleProvider {
	edition: TextEdition
	name: string
	books: readonly BookId[]
	getPassage(ranges: readonly PassageRange[]): Promise<PassageText>
}
