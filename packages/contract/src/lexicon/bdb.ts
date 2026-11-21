import { z } from 'zod'

const bdbSegmentSchema = z.object({
	kind: z.enum(['def', 'hebrew', 'ref', 'text']),
	text: z.string().min(1),
})
export type BdbSegment = z.infer<typeof bdbSegmentSchema>

const bdbSenseSchema = z.object({
	number: z.string().optional(),
	label: z.string().optional(),
	text: z.array(bdbSegmentSchema),
	get senses() {
		return z.array(bdbSenseSchema)
	},
})
export type BdbSense = z.infer<typeof bdbSenseSchema>

export const bdbEntrySchema = z.object({
	id: z.string().min(1),
	lemma: z.string(),
	gloss: z.string(),
	pos: z.string().optional(),
	count: z.number().int().nonnegative().optional(),
	senses: z.array(bdbSenseSchema),
})
export type BdbEntry = z.infer<typeof bdbEntrySchema>
export const bdbEntriesSchema = z.array(bdbEntrySchema)
export const bdbName = 'Brown-Driver-Briggs'

export function bdbDisplaySenses(entry: BdbEntry): BdbSense[] {
	const root = entry.senses.length === 1 ? entry.senses[0] : undefined
	return root && root.senses.length && !root.label ? root.senses : entry.senses
}

export function bdbMetadata(entry: BdbEntry): string {
	return [
		entry.pos,
		entry.count === undefined
			? undefined
			: `${new Intl.NumberFormat('en').format(entry.count)} ${entry.count === 1 ? 'occurrence' : 'occurrences'}`,
	]
		.filter(Boolean)
		.join(' · ')
}

export const bdbMarker = ({ sense, index }: { sense: BdbSense; index: number }) =>
	(sense.number || String(index + 1)).replace(/^\(|\)$/g, '')

export const bdbSegmentSeparator = ({
	previous,
	segment,
}: {
	previous?: BdbSegment
	segment: BdbSegment
}) => (previous ? (previous.kind === 'def' && segment.kind === 'def' ? ', ' : ' ') : '')

export function bdbCitation({ id, entries }: { id: string; entries: BdbEntry[] }): string {
	const lines = ({ senses, depth }: { senses: BdbSense[]; depth: number }): string[] =>
		senses.flatMap((sense, index) => {
			const marker = sense.label ? `${sense.label}:` : `${bdbMarker({ sense, index })}.`
			const text = sense.text
				.map(
					(segment, at) =>
						bdbSegmentSeparator({ previous: sense.text[at - 1], segment }) + segment.text,
				)
				.join('')
			return [
				`${'  '.repeat(Math.min(depth, 2))}${marker} ${text}`.trimEnd(),
				...lines({ senses: sense.senses, depth: depth + 1 }),
			]
		})
	return entries
		.map((entry) =>
			[
				entry.gloss || entry.lemma,
				bdbMetadata(entry),
				...lines({ senses: bdbDisplaySenses(entry), depth: 0 }),
				`${bdbName} · ${id}`,
			]
				.filter(Boolean)
				.join('\n'),
		)
		.join('\n\n')
}
