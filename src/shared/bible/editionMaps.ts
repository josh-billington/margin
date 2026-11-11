import { z } from 'zod'
import { translationIdSchema, verseRefSchema } from './types'
import type { TextEdition, TranslationId, VerseRef } from './types'
import { refKeySchema, verseKey, verifyVersificationMap } from './versification'
import type { VersificationMap } from './versification'
import type { VerseBoundaries } from './reference'

export const editionMapsSchema = z.object({
	version: z.literal(1),
	corpusRevisions: z.record(translationIdSchema, z.string()),
	maps: z.array(
		z.object({
			source: translationIdSchema,
			target: translationIdSchema,
			entries: z.array(
				z.object({ source: z.array(refKeySchema).min(1), target: z.array(refKeySchema).min(1) }),
			),
		}),
	),
})
export type EditionMaps = z.infer<typeof editionMapsSchema>

export function loadEditionMaps(input: unknown, editions: readonly TextEdition[]): EditionMaps {
	const maps = editionMapsSchema.parse(input)
	for (const id of translationIdSchema.options)
		if (
			maps.corpusRevisions[id] !==
			editions.find((edition) => edition.translationId === id)?.corpusRevision
		)
			throw new Error('Versification map does not match the bundled corpus revision.')
	const pairs = new Set<string>()
	for (const pair of maps.maps) {
		const key = [pair.source, pair.target].sort().join(':')
		if (pair.source === pair.target || pairs.has(key))
			throw new Error('Duplicate or invalid edition mapping pair.')
		pairs.add(key)
	}
	if (pairs.size !== (editions.length * (editions.length - 1)) / 2)
		throw new Error('Missing edition mapping pair.')
	return maps
}

/** Same references map only outside explicit split/merge groups, and only when both editions contain text. */
export function editionPairMap(
	maps: EditionMaps,
	from: TranslationId,
	to: TranslationId,
	refs: (translation: TranslationId) => readonly VerseRef[],
	boundaries: VerseBoundaries,
): VersificationMap {
	const pair = maps.maps.find(
		(pair) =>
			(pair.source === from && pair.target === to) || (pair.target === from && pair.source === to),
	)
	if (!pair) throw new RangeError('No mapping exists for these editions.')
	const entries: VersificationMap['entries'] = pair.entries.map((entry) => ({
		kjv: [],
		jps1917: [],
		bsb: [],
		web: [],
		asv: [],
		[pair.source]: entry.source,
		[pair.target]: entry.target,
	}))
	const claimed = (id: TranslationId) =>
		new Set(entries.flatMap((entry) => entry[id]).map(verseKey))
	const left = claimed(from),
		right = claimed(to)
	const targetRefs = new Set(refs(to).map(verseKey))
	for (const ref of refs(from)) {
		const key = verseKey(ref)
		if (!left.has(key) && !right.has(key) && targetRefs.has(key)) {
			entries.push({ kjv: [], jps1917: [], bsb: [], web: [], asv: [], [from]: [ref], [to]: [ref] })
			left.add(key)
			right.add(key)
		}
	}
	const unmapped: VersificationMap['unmapped'] = []
	for (const [id, covered] of [
		[from, left],
		[to, right],
	] as const)
		for (const ref of refs(id))
			if (!covered.has(verseKey(ref)))
				unmapped.push({
					translationId: id,
					ref: verseRefSchema.parse(ref),
					reason: 'No equivalent verse text in the selected edition.',
				})
	const map = { version: 1 as const, corpusRevisions: maps.corpusRevisions, entries, unmapped }
	verifyVersificationMap(map, boundaries)
	return map
}
