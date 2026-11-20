import { z } from 'zod'
import { bookIdSchema, translationIdSchema, verseRefSchema } from './types'

export const BIBLE_SEARCH_LIMIT = 200
export const BIBLE_SEARCH_QUERY_LENGTH = 256

export const bibleSearchScopeSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('all') }),
	z.object({ kind: z.literal('testament'), testament: z.enum(['old', 'new']) }),
	z.object({ kind: z.literal('book'), book: bookIdSchema }),
])

export const bibleSearchRequestSchema = z.object({
	query: z.string().max(BIBLE_SEARCH_QUERY_LENGTH),
	translation: z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('edition'), id: translationIdSchema }),
		z.object({
			kind: z.literal('default'),
			id: translationIdSchema,
			oldTestamentId: translationIdSchema.optional(),
		}),
	]),
	scope: bibleSearchScopeSchema.optional(),
})

const bibleSearchHitSchema = z.object({
	ref: verseRefSchema,
	translationId: translationIdSchema,
	text: z.string(),
	matches: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().positive()])),
})

export const bibleSearchResultsSchema = z.object({
	total: z.number().int().nonnegative(),
	groups: z.array(
		z.object({
			book: bookIdSchema,
			total: z.number().int().positive(),
			hits: z.array(bibleSearchHitSchema).min(1),
		}),
	),
})

export type BibleSearchRequest = z.infer<typeof bibleSearchRequestSchema>
export type BibleSearchHit = z.infer<typeof bibleSearchHitSchema>
export type BibleSearchResults = z.infer<typeof bibleSearchResultsSchema>
