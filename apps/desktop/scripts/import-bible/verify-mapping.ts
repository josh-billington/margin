import assert from 'node:assert/strict'
import { BibleService } from '../../src/main/bible/provider'
import mapsJson from '../../data/versification/edition-maps.v1.json'
import { loadEditionMaps } from '@shared/bible/editionMaps'
import type { EditionMaps } from '@shared/bible/editionMaps'
import { mapPassage, verifyVersificationMap, verseKey } from '@shared/bible/versification'
import type { VersificationMap } from '@shared/bible/versification'
import { verseRefSchema } from '@shared/bible/types'
import type { BookId, PassageRange, TranslationId, VerseRef } from '@shared/bible/types'

/**
 * Frozen copy of the original whole-corpus algorithm (editionPairMap + verification as shipped
 * before first-preview mapping was made incremental). Do not "improve" it: it is the oracle.
 */
function legacyPairMap(
	maps: EditionMaps,
	from: TranslationId,
	to: TranslationId,
	refs: (translation: TranslationId) => readonly VerseRef[],
): VersificationMap {
	const pair = maps.maps.find(
		(pair) =>
			(pair.source === from && pair.target === to) || (pair.target === from && pair.source === to),
	)
	if (!pair) throw new RangeError('missing pair')
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
					reason: 'The selected translation has no matching text for this verse.',
				})
	return { version: 1 as const, corpusRevisions: maps.corpusRevisions, entries, unmapped }
}

const bible = new BibleService('resources/bible/margin-bible.sqlite')
try {
	const boundaries = (id: TranslationId, book: BookId, chapter: number) =>
		bible.providers[id].verseNumbers(book, chapter)
	const maps = loadEditionMaps(mapsJson, bible.listTranslations())
	const range = (ref: VerseRef): PassageRange => ({ start: ref, end: ref })
	const span = (refs: readonly VerseRef[]): PassageRange => {
		const start = refs[0],
			end = refs.at(-1)
		if (!start || !end) throw new Error('Empty chapter')
		return { start, end }
	}
	let comparisons = 0
	let partialGroupCases = 0
	for (const pair of maps.maps) {
		const legacy = legacyPairMap(maps, pair.source, pair.target, (id) =>
			bible.providers[id].allRefs(),
		)
		verifyVersificationMap(legacy, boundaries)
		for (const [from, to] of [
			[pair.source, pair.target],
			[pair.target, pair.source],
		] as const) {
			const chapters = new Map<string, VerseRef[]>()
			for (const ref of bible.providers[from].allRefs()) {
				const key = `${ref.book}.${ref.chapter}`
				const refs = chapters.get(key) ?? []
				refs.push(ref)
				chapters.set(key, refs)
			}
			const entriesByChapter = new Map<string, VersificationMap['entries']>()
			for (const entry of legacy.entries)
				for (const key of new Set(entry[from].map((ref) => `${ref.book}.${ref.chapter}`))) {
					const list = entriesByChapter.get(key) ?? []
					list.push(entry)
					entriesByChapter.set(key, list)
				}
			// Whole corpus at once, ranges in reverse order, so cross-book ordering is compared too.
			const everything = [...chapters.values()].reverse().map((refs) => span(refs))
			assert.deepEqual(
				bible.mapPassage(from, everything, to),
				mapPassage(legacy, from, everything, boundaries, to),
				`${from}:${to} whole corpus`,
			)
			comparisons++
			for (const [key, refs] of chapters) {
				// mapPassage skips entries with no selected source verse and only reads unmapped records
				// for selected verses, so for a selection inside this chapter these oracle inputs are equivalent.
				const inChapter = new Set(refs.map(verseKey))
				const expected: VersificationMap = {
					...legacy,
					entries: entriesByChapter.get(key) ?? [],
					unmapped: legacy.unmapped.filter(
						(entry) => entry.translationId === from && inChapter.has(verseKey(entry.ref)),
					),
				}
				const groupRefs = (entriesByChapter.get(key) ?? [])
					.filter((entry) => entry[from].length > 1 || entry[to].length > 1)
					.flatMap((entry) => entry[from].filter((ref) => inChapter.has(verseKey(ref))))
				const half = refs.slice(0, Math.ceil(refs.length / 2))
				const selections = [
					refs,
					half,
					refs.slice(1),
					[...refs, ...refs],
					[...refs].reverse(),
					...groupRefs.map((ref) => [ref]),
					...groupRefs.map((ref) => refs.filter((other) => verseKey(other) !== verseKey(ref))),
				]
				partialGroupCases += groupRefs.length * 2
				for (const selection of selections) {
					const ranges = selection.map(range)
					assert.deepEqual(
						bible.mapPassage(from, ranges, to),
						mapPassage(expected, from, ranges, boundaries, to),
						`${from}:${to} ${key}`,
					)
					comparisons++
				}
			}
			// Partial groups that cross chapter and book boundaries, against the unfiltered oracle.
			for (const entry of legacy.entries) {
				const source = entry[from]
				const [first, ...rest] = source
				const last = source.at(-1)
				if (!first || !last || !rest.length) continue
				const crossing = new Set(source.map((ref) => `${ref.book}.${ref.chapter}`)).size > 1
				for (const selection of crossing ? [[first], [last], rest] : [source.slice(0, 1)]) {
					const ranges = selection.map(range)
					assert.deepEqual(
						bible.mapPassage(from, ranges, to),
						mapPassage(legacy, from, ranges, boundaries, to),
						`${from}:${to} group ${verseKey(first)}`,
					)
					comparisons++
				}
			}
		}
	}
	console.info(
		`${comparisons} whole-corpus mapping comparisons passed (${partialGroupCases} partial split/merge selections)`,
	)
} finally {
	bible.close()
}
