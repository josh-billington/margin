import { migrateStudy } from '@margin/contract/study/migrations'
import { isDiagramRecord } from '@margin/contract/study/diagrams'
import {
	marginPageMetadataSchema,
	notePropsSchema,
	passagePropsSchema,
	wordTargetSchema,
} from '@margin/contract/study/types'
import { z } from 'zod'

const position = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	rotation: z.number(),
	parentId: z.string(),
})
const noteProps = notePropsSchema.extend({ strokes: z.array(z.unknown()).optional() })
const shape = position.extend({ type: z.string(), props: z.unknown(), meta: z.unknown() })
const arrowBinding = z.object({
	fromId: z.string(),
	toId: z.string(),
	props: z.object({ terminal: z.enum(['start', 'end']), target: wordTargetSchema.optional() }),
	meta: z.object({ target: wordTargetSchema.optional() }),
})
const inkArrow = z.object({ kind: z.enum(['ink', 'arrow']) })
// Pencil ink bindings keep their word target under `anchor`; read them in the arrow binding's shape.
const inkBinding = z
	.object({
		fromId: z.string(),
		toId: z.string(),
		props: z.object({
			terminal: z.enum(['start', 'end']),
			anchor: z.object({ target: wordTargetSchema.optional() }),
		}),
	})
	.transform(({ fromId, toId, props }) => ({
		fromId,
		toId,
		props: { terminal: props.terminal, target: props.anchor.target },
		meta: {},
	}))
const recordHeader = z.object({ typeName: z.string(), type: z.string().optional() })
const labelProps = z.object({ richText: z.unknown() })
const richNode = z.object({
	type: z.string(),
	text: z.string().optional(),
	content: z.array(z.unknown()).optional(),
})

function labelText(input: unknown): string {
	const node = richNode.safeParse(input)
	if (!node.success) return ''
	const { type, text, content } = node.data
	if (type === 'hardBreak') return '\n'
	if (typeof text === 'string') return text
	return (content ?? []).map(labelText).join(type === 'doc' ? '\n' : '')
}

export function parseStudy(input: unknown) {
	const { id, title, updatedAt, document } = migrateStudy(input)
	const positions: z.infer<typeof position>[] = []
	const passages: { id: string; props: z.infer<typeof passagePropsSchema> }[] = []
	const notes: { id: string; props: z.infer<typeof noteProps> }[] = []
	const arrows: string[] = []
	let diagramShapes = 0
	const diagramLabels: { id: string; text: string }[] = []
	const bindings: z.infer<typeof arrowBinding>[] = []
	let tags: z.infer<typeof marginPageMetadataSchema>['tags'] = []
	for (const record of Object.values(document.store)) {
		const { typeName, type } = recordHeader.parse(record)
		if (typeName === 'page') {
			tags = z.object({ meta: marginPageMetadataSchema }).parse(record).meta.tags
		} else if (typeName === 'shape') {
			const parsed = shape.parse(record)
			positions.push(parsed)
			if (type === 'passage') {
				passages.push({ id: parsed.id, props: passagePropsSchema.parse(parsed.props) })
			} else if (type === 'margin-note' || type === 'note') {
				notes.push({ id: parsed.id, props: noteProps.parse(parsed.props) })
			} else if (type === 'arrow') {
				arrows.push(parsed.id)
			} else if (type === 'margin-ink' && inkArrow.parse(parsed.props).kind === 'arrow') {
				arrows.push(parsed.id)
			} else if (isDiagramRecord(parsed)) {
				if (type !== 'text') diagramShapes++
				if (type === 'line') continue
				const label = labelProps.safeParse(parsed.props)
				const text = label.success ? labelText(label.data.richText).trim() : ''
				if (text) diagramLabels.push({ id: parsed.id, text })
			}
		} else if (typeName === 'binding' && type === 'arrow') {
			bindings.push(arrowBinding.parse(record))
		} else if (typeName === 'binding' && type === 'margin-ink') {
			bindings.push(inkBinding.parse(record))
		}
	}
	return {
		id,
		title,
		updatedAt,
		positions,
		passages,
		notes,
		arrows,
		bindings,
		tags,
		diagramShapes,
		diagramLabels,
	}
}

export type Study = ReturnType<typeof parseStudy>
