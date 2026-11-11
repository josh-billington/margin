import { z } from 'zod'
import { passageTextSchema, textEditionSchema, verseRefSchema, verseSchema } from '../bible/types'
import { wordTargetSchema } from '../study/types'

export const strongIdSchema = z
	.string()
	.trim()
	.regex(/^[HG]0*[1-9]\d*$/i)
	.transform((id) => `${id[0]?.toUpperCase()}${id.slice(1).replace(/^0+/, '')}`)
export const lexiconEntrySchema = z.object({
	id: strongIdSchema,
	lemma: z.string(),
	transliteration: z.string(),
	definition: z.string(),
	renderings: z.string(),
	derivation: z.string(),
	source: z.string(),
})
export type LexiconEntry = z.infer<typeof lexiconEntrySchema>
export const sourceSpanSchema = z
	.object({
		ref: verseRefSchema,
		first: z.number().int().nonnegative(),
		last: z.number().int().nonnegative(),
		text: z.string(),
		ids: z.array(strongIdSchema).min(1),
	})
	.refine((span) => span.first <= span.last)
export type SourceSpan = z.infer<typeof sourceSpanSchema>
export const annotationVerseSchema = z.object({
	edition: textEditionSchema,
	verse: verseSchema,
	spans: z.array(sourceSpanSchema),
})
export const lookupRequestSchema = z.object({
	text: passageTextSchema,
	start: wordTargetSchema,
	end: wordTargetSchema,
})
export type LookupRequest = z.infer<typeof lookupRequestSchema>
export const lookupResultSchema = z.object({
	status: z.enum(['matched', 'unsupported-translation', 'snapshot-mismatch']),
	spans: z.array(sourceSpanSchema),
})
export type LookupResult = z.infer<typeof lookupResultSchema>
/**
 * The dictionary's own name ("Strong's Hebrew Dictionary"). Bundled entries carry the data
 * provider after a " · " ("… · Open Scriptures"); that credit lives in the README, not in the
 * reader's notes or clipboard.
 */
export const dictionaryName = (entry: LexiconEntry) => entry.source.split(' · ')[0] ?? entry.source
export const entryCitation = (entry: LexiconEntry) =>
	`${entry.lemma} (${entry.transliteration}, ${entry.id}) — ${entry.definition}\n${dictionaryName(entry)} · ${entry.id}`
