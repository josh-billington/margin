import { migrateStudy } from '@margin/contract/study/migrations'
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
const shape = position.extend({ type: z.string(), props: z.unknown() })
const arrowBinding = z.object({
	fromId: z.string(),
	toId: z.string(),
	props: z.object({ terminal: z.enum(['start', 'end']), target: wordTargetSchema.optional() }),
	meta: z.object({ target: wordTargetSchema.optional() }),
})
const recordHeader = z.object({ typeName: z.string(), type: z.string().optional() })

export function parseStudy(input: unknown) {
	const { id, title, updatedAt, document } = migrateStudy(input)
	const positions: z.infer<typeof position>[] = []
	const passages: { id: string; props: z.infer<typeof passagePropsSchema> }[] = []
	const notes: { id: string; props: z.infer<typeof noteProps> }[] = []
	const arrows: string[] = []
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
			}
		} else if (typeName === 'binding' && type === 'arrow') {
			bindings.push(arrowBinding.parse(record))
		}
	}
	return { id, title, updatedAt, positions, passages, notes, arrows, bindings, tags }
}

export type Study = ReturnType<typeof parseStudy>
