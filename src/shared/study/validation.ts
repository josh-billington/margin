import { z } from 'zod'
import type { studyFileEnvelopeSchema } from './types'
import {
	marginPageMetadataSchema,
	passagePropsSchema,
	notePropsSchema,
	wordBindingMetadataSchema,
} from './types'

const base = z
	.object({ id: z.string().min(1), typeName: z.string(), meta: z.record(z.string(), z.json()) })
	.passthrough()
const shape = base.extend({
	typeName: z.literal('shape'),
	id: z.string().startsWith('shape:'),
	type: z.string().min(1),
	x: z.number().finite(),
	y: z.number().finite(),
	rotation: z.number().finite(),
	index: z.string().min(1),
	parentId: z.string().regex(/^(page|shape):.+/),
	isLocked: z.boolean(),
	opacity: z.number().min(0).max(1),
	props: z.record(z.string(), z.json()),
})
const binding = base.extend({
	typeName: z.literal('binding'),
	id: z.string().startsWith('binding:'),
	type: z.string().min(1),
	fromId: z.string().startsWith('shape:'),
	toId: z.string().startsWith('shape:'),
	props: z.record(z.string(), z.json()),
})
// SDK migrations and registered shape validators still run in loadSnapshot. These
// checks reject malformed documents before they can enter the library index.
export function validateDocument(document: z.infer<typeof studyFileEnvelopeSchema>['document']) {
	z.object({
		schemaVersion: z.literal(2),
		sequences: z.record(z.string(), z.number().int().nonnegative()),
	}).parse(document.schema)
	let pages = 0
	const tags = new Set<string>()
	const records = Object.entries(document.store).map(([key, value]) => {
		const record = base.parse(value)
		if (record.id !== key) throw new Error('Snapshot record ID does not match its key.')
		if (record.typeName === 'page') {
			pages++
			z.object({
				id: z.string().startsWith('page:'),
				name: z.string(),
				index: z.string().min(1),
			}).parse(record)
			for (const tag of marginPageMetadataSchema.parse(record.meta).tags) {
				if (tags.has(tag.id)) throw new Error('Duplicate page tag ID.')
				tags.add(tag.id)
			}
		} else if (record.typeName === 'shape') shape.parse(record)
		else if (record.typeName === 'binding') binding.parse(record)
		else if (record.typeName === 'document')
			z.object({
				id: z.literal('document:document'),
				name: z.string(),
				gridSize: z.number().positive(),
			}).parse(record)
		else if (record.typeName === 'user')
			z.object({
				id: z.string().startsWith('user:'),
				name: z.string(),
				color: z.string(),
				imageUrl: z.string(),
			}).parse(record)
		else if (record.typeName === 'asset')
			z.object({
				id: z.string().startsWith('asset:'),
				type: z.string(),
				props: z.record(z.string(), z.json()),
			}).parse(record)
		else throw new Error(`Unexpected document record: ${record.typeName}`)
		return record
	})
	if (pages !== 1) throw new Error('A study must contain exactly one page.')
	for (const record of records) {
		if (record.typeName === 'binding') {
			const parsed = binding.parse(record)
			if (!document.store[parsed.fromId] || !document.store[parsed.toId])
				throw new Error('Binding refers to a missing shape.')
			if (parsed.meta.schemaVersion !== undefined) wordBindingMetadataSchema.parse(parsed.meta)
		}
		if (record.typeName !== 'shape') continue
		const parsed = shape.parse(record)
		if (!document.store[parsed.parentId]) throw new Error('Shape refers to a missing parent.')
		if (parsed.type === 'note') notePropsSchema.parse(parsed.props)
		if (parsed.type === 'passage') {
			const props = passagePropsSchema.parse(parsed.props)
			const words = props.text.verses.flatMap((verse) =>
				verse.tokens.map((token) => ({ verse: verse.ref, token })),
			)
			for (const highlight of props.highlights) {
				if (highlight.tagId !== undefined && !tags.has(highlight.tagId))
					throw new Error('Highlight refers to a missing tag.')
				const start = words.findIndex(
					(word) =>
						JSON.stringify(word.verse) === JSON.stringify(highlight.start.verse) &&
						word.token.i === highlight.start.token,
				)
				const end = words.findIndex(
					(word) =>
						JSON.stringify(word.verse) === JSON.stringify(highlight.end.verse) &&
						word.token.i === highlight.end.token,
				)
				if (start < 0 || end < start)
					throw new Error('Highlight is outside its scripture snapshot.')
			}
		}
	}
}
