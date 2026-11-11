import { z } from 'zod'
import { tokenize } from '../../src/shared/bible/tokenizer'
import type { BookId } from '../../src/shared/bible/types'
import type { ImportedBook, SourceMetadata } from './usfm'

export const jpsSourceSchema = z
	.object({
		versionTitle: z.literal('The Holy Scriptures: A New Translation (JPS 1917)'),
		license: z.literal('Public Domain'),
		versionNotes: z.string(),
		versionSource: z.string(),
		text: z.array(z.array(z.string().min(1))).min(1),
	})
	.passthrough()

export function importJps(id: BookId, input: unknown): ImportedBook {
	const source = jpsSourceSchema.parse(input)
	const metadata: SourceMetadata[] = []
	return {
		id,
		metadata,
		verses: source.text.flatMap((chapter, c) =>
			chapter.map((text, v) => {
				// Three small-print liturgical repeats are reading aids, not additional verse text.
				const plain = text.replace(
					/<br\s*\/?\s*><small>([\s\S]*?)<\/small>/g,
					(_match, repeat: string) => {
						metadata.push({ chapter: c + 1, verse: v + 1, kind: 'liturgical-repeat', text: repeat })
						return ''
					},
				)
				if (/<[^>]+>|&[a-z#0-9]+;/i.test(plain))
					throw new Error(`Unhandled JPS markup in ${id}.${c + 1}.${v + 1}`)
				return {
					ref: { book: id, chapter: c + 1, verse: v + 1 },
					paragraphBreakBefore: v === 0,
					tokens: tokenize(plain.trim()),
				}
			}),
		),
	}
}
