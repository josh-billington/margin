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
	/** The `next` cursor of the previous page; omitted for the first page. */
	after: z.number().int().nonnegative().optional(),
})

const bibleSearchHitSchema = z.object({
	ref: verseRefSchema,
	translationId: translationIdSchema,
	text: z.string(),
	matches: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().positive()])),
})

const bibleSearchCountsSchema = z.object({
	total: z.number().int().nonnegative(),
	books: z.array(z.object({ book: bookIdSchema, total: z.number().int().positive() })),
})

/** Up to BIBLE_SEARCH_LIMIT hits in canonical order; later pages append to earlier ones. */
export const bibleSearchPageSchema = z.object({
	hits: z.array(bibleSearchHitSchema).max(BIBLE_SEARCH_LIMIT),
	/** Pass as `after` for the following page; null once this page reaches the last hit. */
	next: z.number().int().nonnegative().nullable(),
	/** Counted with the first page only: the totals don't change while paging. */
	counts: bibleSearchCountsSchema.nullable(),
})

export type BibleSearchRequest = z.infer<typeof bibleSearchRequestSchema>
export type BibleSearchHit = z.infer<typeof bibleSearchHitSchema>
export type BibleSearchCounts = z.infer<typeof bibleSearchCountsSchema>
export type BibleSearchPage = z.infer<typeof bibleSearchPageSchema>
