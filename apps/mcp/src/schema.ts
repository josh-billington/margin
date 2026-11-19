import { paletteColorSchema, tagSchema } from '@margin/contract/study/types'
import { z } from 'zod'

export const toolIdSchema = z.string().regex(z.regexes.ulid)
const tag = tagSchema.extend({ id: toolIdSchema })
const studyIdentity = z.object({ id: toolIdSchema, title: z.string() })
const studySummary = studyIdentity.extend({ updatedAt: z.iso.datetime() })
const counts = z.object({ highlights: z.number(), notes: z.number(), arrows: z.number() })
const warning = z.object({ id: toolIdSchema, message: z.string() })

export const listOutput = z.object({
	studies: z.array(studySummary.extend({ passages: z.array(z.string()), counts })),
	warnings: z.array(warning),
})

const passageLink = z.object({ passageId: z.string(), reference: z.string() })
const attachment = z.discriminatedUnion('kind', [
	passageLink.extend({ kind: z.literal('passage') }),
	passageLink.extend({ kind: z.literal('verse'), verse: z.string() }),
	z.object({ kind: z.literal('free'), nearest: passageLink.nullable() }),
])
const highlightStyle = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('tag'), tag }),
	z.object({ kind: z.literal('color'), color: paletteColorSchema }),
])
const highlight = z.object({ quote: z.string(), reference: z.string(), style: highlightStyle })
const verse = z.object({
	reference: z.string(),
	number: z.number(),
	text: z.string(),
	paragraphBreakBefore: z.boolean(),
	italicSpans: z
		.array(z.object({ start: z.number(), end: z.number() }))
		.optional()
		.describe('Supplied-word spans in text, using zero-based UTF-16 offsets, end exclusive.'),
})
const passageBlock = z.object({
	kind: z.literal('passage'),
	id: z.string(),
	reference: z.string(),
	translation: z.string(),
	verses: z.array(verse),
	highlights: z.array(highlight),
})
const noteBlock = z.object({
	kind: z.literal('note'),
	id: z.string(),
	text: z.string(),
	handwrittenInk: z.boolean(),
	attachment,
})
const endpoint = z.discriminatedUnion('kind', [
	passageLink.extend({ kind: z.literal('passage') }),
	passageLink.extend({ kind: z.literal('verse'), verse: z.string() }),
	passageLink.extend({ kind: z.literal('word'), verse: z.string(), quote: z.string() }),
	z.object({
		kind: z.literal('note'),
		noteId: z.string(),
		text: z.string(),
		handwrittenInk: z.boolean(),
	}),
	z.object({ kind: z.literal('shape'), shapeId: z.string() }),
	z.object({ kind: z.literal('unbound') }),
])

export const outlineOutput = studySummary.extend({
	blocks: z.array(z.discriminatedUnion('kind', [passageBlock, noteBlock])),
	arrows: z.array(
		z.object({ id: z.string(), from: endpoint, to: endpoint, description: z.string() }),
	),
	tags: z.array(tag),
})

export const searchOutput = z.object({
	studies: z.array(
		studyIdentity.extend({
			matches: z.array(
				z.object({ field: z.enum(['title', 'note', 'reference']), snippet: z.string() }),
			),
		}),
	),
	warnings: z.array(warning),
})

export type StudyList = z.infer<typeof listOutput>
export type Outline = z.infer<typeof outlineOutput>
export type OutlineVerse = z.infer<typeof verse>
export type OutlineHighlight = z.infer<typeof highlight>
export type Attachment = z.infer<typeof attachment>
export type Endpoint = z.infer<typeof endpoint>
export type Search = z.infer<typeof searchOutput>
