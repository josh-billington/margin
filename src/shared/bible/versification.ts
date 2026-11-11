import { z } from 'zod'
import { books } from './books'
import { passageRangeSchema, translationIdSchema, verseRefSchema } from './types'
import type { BookId, PassageRange, TextEdition, TranslationId, VerseRef } from './types'
import type { VerseBoundaries } from './reference'

export const refKeySchema = z.string().transform((value, context) => {
	const [book, chapter, verse] = value.split('.')
	const parsed = verseRefSchema.safeParse({ book, chapter: Number(chapter), verse: Number(verse) })
	if (!parsed.success) {
		context.addIssue({ code: 'custom', message: `Invalid verse key ${value}` })
		return z.NEVER
	}
	return parsed.data
})
export const versificationMapSchema = z.object({
	version: z.literal(1),
	corpusRevisions: z.partialRecord(translationIdSchema, z.string()),
	entries: z.array(
		z.object({
			kjv: z.array(refKeySchema),
			jps1917: z.array(refKeySchema),
			bsb: z.array(refKeySchema).default([]),
			web: z.array(refKeySchema).default([]),
			asv: z.array(refKeySchema).default([]),
		}),
	),
	unmapped: z.array(
		z.object({ translationId: translationIdSchema, ref: refKeySchema, reason: z.string() }),
	),
})
export type VersificationMap = z.infer<typeof versificationMapSchema>
export function loadVersificationMap(
	input: unknown,
	editions: readonly TextEdition[],
	boundaries: VerseBoundaries,
): VersificationMap {
	const map = versificationMapSchema.parse(input)
	for (const translation of translationIdSchema.options.filter((id) => map.corpusRevisions[id]))
		if (
			map.corpusRevisions[translation] !==
			editions.find((edition) => edition.translationId === translation)?.corpusRevision
		)
			throw new Error('Versification map does not match the bundled corpus revision.')
	verifyVersificationMap(map, boundaries)
	return map
}

export const verseKey = (ref: VerseRef) => `${ref.book}.${ref.chapter}.${ref.verse}`

export function expandRanges(
	ranges: readonly PassageRange[],
	translation: TranslationId,
	boundaries: VerseBoundaries,
): VerseRef[] {
	return ranges.flatMap((input) => {
		const range = passageRangeSchema.parse(input)
		const refs: VerseRef[] = []
		if (
			!boundaries(translation, range.start.book, range.start.chapter).includes(range.start.verse) ||
			!boundaries(translation, range.end.book, range.end.chapter).includes(range.end.verse)
		)
			throw new RangeError('Mapping range endpoint does not exist.')
		for (let chapter = range.start.chapter; chapter <= range.end.chapter; chapter++) {
			const numbers = boundaries(translation, range.start.book, chapter)
			if (!numbers.length) throw new RangeError('Mapping range contains a missing chapter.')
			for (const verse of numbers)
				if (
					(chapter !== range.start.chapter || verse >= range.start.verse) &&
					(chapter !== range.end.chapter || verse <= range.end.verse)
				)
					refs.push({ book: range.start.book, chapter, verse })
		}
		return refs
	})
}

/** Returns explicit groups, never silently narrows a merged verse or fills unmapped content. */
export function mapPassage(
	map: VersificationMap,
	from: TranslationId,
	ranges: readonly PassageRange[],
	boundaries: VerseBoundaries,
	to: TranslationId = from === 'kjv' ? 'jps1917' : 'kjv',
) {
	const selected = new Set(expandRanges(ranges, from, boundaries).map(verseKey))
	const mapped: PassageRange[] = []
	const unmapped: { ref: VerseRef; reason: string }[] = []
	const partialGroups: { source: VerseRef[]; target: VerseRef[] }[] = []
	const covered = new Set<string>()
	for (const entry of map.entries) {
		if (!entry[from].some((ref) => selected.has(verseKey(ref)))) continue
		entry[from].forEach((ref) => covered.add(verseKey(ref)))
		if (!entry[to].length) {
			for (const ref of entry[from].filter((ref) => selected.has(verseKey(ref))))
				unmapped.push({ ref, reason: `This verse has no equivalent text in ${to.toUpperCase()}.` })
			continue
		}
		if (!entry[from].every((ref) => selected.has(verseKey(ref))))
			partialGroups.push({ source: entry[from], target: entry[to] })
		for (const ref of entry[to]) mapped.push({ start: ref, end: ref })
	}
	for (const entry of map.unmapped) {
		if (entry.translationId === from && selected.has(verseKey(entry.ref))) {
			unmapped.push({ ref: entry.ref, reason: entry.reason })
			covered.add(verseKey(entry.ref))
		}
	}
	for (const ref of expandRanges(ranges, from, boundaries))
		if (!covered.has(verseKey(ref)))
			unmapped.push({ ref, reason: 'Reference has no verified mapping entry.' })
	return {
		kind: unmapped.length
			? ('incomplete' as const)
			: partialGroups.length
				? ('confirmation-required' as const)
				: ('mapped' as const),
		translation: to,
		ranges: compactRanges(
			mapped.map((range) => range.start),
			to,
			boundaries,
		),
		unmapped,
		partialGroups,
	}
}

/** Verifies every reference and disjoint coverage; the importer also checks corpus revisions. */
export function verifyVersificationMap(map: VersificationMap, boundaries: VerseBoundaries): void {
	const seen: Record<TranslationId, Set<string>> = {
		kjv: new Set(),
		jps1917: new Set(),
		bsb: new Set(),
		web: new Set(),
		asv: new Set(),
	}
	function check(
		translation: TranslationId,
		ref: { book: BookId; chapter: number; verse: number },
	) {
		if (!boundaries(translation, ref.book, ref.chapter).includes(ref.verse))
			throw new Error(`Missing mapped verse ${translation} ${verseKey(ref)}`)
		const key = verseKey(ref)
		if (seen[translation].has(key))
			throw new Error(`Duplicate mapping classification ${translation} ${key}`)
		seen[translation].add(key)
	}
	for (const entry of map.entries)
		for (const translation of translationIdSchema.options)
			for (const ref of entry[translation]) check(translation, ref)
	for (const entry of map.unmapped) check(entry.translationId, entry.ref)
}

function compactRanges(
	input: VerseRef[],
	translation: TranslationId,
	boundaries: VerseBoundaries,
): PassageRange[] {
	const refs = [...new Map(input.map((ref) => [verseKey(ref), ref])).values()].sort(
		(a, b) =>
			books.findIndex((book) => book.id === a.book) -
				books.findIndex((book) => book.id === b.book) ||
			a.chapter - b.chapter ||
			a.verse - b.verse,
	)
	const ranges: PassageRange[] = []
	for (const ref of refs) {
		const previous = ranges.at(-1)
		if (
			previous &&
			previous.end.book === ref.book &&
			((previous.end.chapter === ref.chapter && previous.end.verse + 1 === ref.verse) ||
				(previous.end.chapter + 1 === ref.chapter &&
					previous.end.verse === boundaries(translation, ref.book, previous.end.chapter).at(-1) &&
					ref.verse === boundaries(translation, ref.book, ref.chapter)[0]))
		)
			previous.end = ref
		else ranges.push({ start: ref, end: ref })
	}
	return ranges
}
