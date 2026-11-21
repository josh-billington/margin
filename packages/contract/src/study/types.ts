import type { TLStoreSnapshot } from 'tldraw'
import { z } from 'zod'
import { passageTextSchema, verseRefSchema } from '../bible/types'

// Same accepted values as z.json(), checked in one pass: zod's recursive union costs ~50 ms on a large study.
const MAX_JSON_DEPTH = 200
function isJson(value: unknown, depth = 0): boolean {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
	if (typeof value === 'number') return Number.isFinite(value)
	if (typeof value !== 'object' || depth > MAX_JSON_DEPTH) return false
	if (Array.isArray(value)) return value.every((item) => isJson(item, depth + 1))
	const prototype: unknown = Object.getPrototypeOf(value)
	if (prototype !== Object.prototype && prototype !== null) return false
	return Object.values(value).every((item) => isJson(item, depth + 1))
}
export const jsonSchema = z.custom<z.core.util.JSONType>((value) => isJson(value), 'Invalid JSON')

export const ulidSchema = z.ulid()
export type ULID = z.infer<typeof ulidSchema>
export const paletteColorSchema = z.enum(['sky', 'violet', 'rose', 'coral', 'amber', 'green'])
export type PaletteColor = z.infer<typeof paletteColorSchema>
export const tagSchema = z.object({
	id: ulidSchema,
	name: z.string().trim().min(1),
	color: paletteColorSchema,
})
export type Tag = z.infer<typeof tagSchema>
export const marginPageMetadataSchema = z.object({
	schemaVersion: z.literal(1),
	tags: z.array(tagSchema),
	// Annotations that failed load validation (SPEC §7.4); kept for recovery, never reattached.
	invalidAnnotations: z.array(jsonSchema).optional(),
})
export type MarginPageMetadata = z.infer<typeof marginPageMetadataSchema>
export const wordTargetSchema = z.object({
	verse: verseRefSchema,
	token: z.number().int().nonnegative(),
})
export type WordTarget = z.infer<typeof wordTargetSchema>
export const wordBindingMetadataSchema = z.object({
	schemaVersion: z.literal(1),
	target: wordTargetSchema,
})
export type WordBindingMetadata = z.infer<typeof wordBindingMetadataSchema>
// A highlight is either tagged (uses the tag's colour) or plain (carries its own colour).
export const highlightSchema = z
	.object({
		id: ulidSchema,
		tagId: ulidSchema.optional(),
		color: paletteColorSchema.optional(),
		start: wordTargetSchema,
		end: wordTargetSchema,
	})
	.refine((h) => (h.tagId === undefined) !== (h.color === undefined), {
		message: 'A highlight needs exactly one of tagId or color.',
	})
export type Highlight = z.infer<typeof highlightSchema>
export const passagePropsSchema = z.object({
	width: z.number().min(240),
	text: passageTextSchema,
	layout: z.enum(['flow', 'verse-per-line']),
	showVerseNumbers: z.boolean(),
	showSuppliedWordItalics: z.boolean(),
	fontScale: z.number().positive(),
	highlights: z.array(highlightSchema),
	pulledFrom: z.object({ passageId: z.string().min(1), verse: verseRefSchema }).optional(),
})
export type PassageProps = z.infer<typeof passagePropsSchema>
const pointSchema = z.object({ x: z.number(), y: z.number() })
export const inkPointSchema = pointSchema.extend({ z: z.number().min(0).max(1) })
export const inkStrokeSchema = z.tuple([inkPointSchema], inkPointSchema)
export type InkPoint = z.infer<typeof inkPointSchema>
export type InkStroke = z.infer<typeof inkStrokeSchema>
export const inkShapePropsSchema = z.object({
	kind: z.enum(['ink', 'arrow']),
	points: inkStrokeSchema,
	size: z.number().positive(),
})
export type InkShapeProps = z.infer<typeof inkShapePropsSchema>
const inkAnchorSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('block'), point: pointSchema }),
	z.object({
		kind: z.literal('word'),
		point: pointSchema,
		target: wordTargetSchema,
		direction: pointSchema,
	}),
])
export const inkBindingPropsSchema = z.object({
	terminal: z.enum(['start', 'end']),
	anchor: inkAnchorSchema,
})
export type InkBindingProps = z.infer<typeof inkBindingPropsSchema>
export const notePropsSchema = z.object({
	width: z.number().positive().optional(),
	text: z.string(),
	size: z.enum(['S', 'M', 'L', 'XL']),
	color: z.enum(['ink', ...paletteColorSchema.options]),
	font: z.enum(['handwritten', 'plain']),
	strokes: z.array(inkStrokeSchema).default([]),
	association: z
		.object({ passageId: z.string().min(1), verse: verseRefSchema.optional() })
		.optional(),
})
export type NoteProps = z.infer<typeof notePropsSchema>
export const INK_STUDY_VERSION = 2
export const STUDY_SCHEMA_VERSION = 3
export const studyMetadataSchema = z.object({
	format: z.literal('margin-study'),
	schemaVersion: z.literal([1, INK_STUDY_VERSION, STUDY_SCHEMA_VERSION]),
	id: ulidSchema,
	title: z.string().trim().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	revision: z.number().int().nonnegative(),
})
export type TldrawDocumentSnapshot = TLStoreSnapshot
export type StudyFile = z.infer<typeof studyMetadataSchema> & {
	document: TldrawDocumentSnapshot
}

// Validate the transport envelope here; SDK record/shape validation belongs to the
// registered tldraw schema in the study loader, which is intentionally not implemented yet.
export const studyFileEnvelopeSchema = studyMetadataSchema.extend({
	document: z.object({
		store: z.record(z.string(), jsonSchema),
		schema: jsonSchema,
	}),
})
