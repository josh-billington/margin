import { z } from 'zod'
import { lexiconEntrySchema, strongIdSchema } from '../../src/shared/lexicon/types'

const rawEntry = z.object({
	lemma: z.string(),
	xlit: z.string().optional(),
	translit: z.string().optional(),
	strongs_def: z.string().optional(),
	kjv_def: z.string().optional(),
	derivation: z.string().optional(),
})

export function parseDictionary(source: string, language: 'Hebrew' | 'Greek') {
	const variable = `strongs${language}Dictionary`
	const match = new RegExp(
		`^\\s*/\\*\\*[\\s\\S]*?\\*/\\s*var ${variable} = (\\{[\\s\\S]*\\});\\s*(?:module.exports = ${variable};)?\\s*$`,
	).exec(source)
	if (!match?.[1]) throw new Error(`Unexpected ${language} dictionary data wrapper`)
	const entries = z.record(strongIdSchema, rawEntry).parse(JSON.parse(match[1]))
	return Object.entries(entries).map(([id, entry]) =>
		lexiconEntrySchema.parse({
			id,
			lemma: entry.lemma,
			transliteration: entry.xlit ?? entry.translit ?? '',
			definition: entry.strongs_def?.trim() ?? '',
			renderings: entry.kjv_def ?? '',
			derivation: entry.derivation ?? '',
			source: `Strong's ${language} Dictionary · Open Scriptures`,
		}),
	)
}
