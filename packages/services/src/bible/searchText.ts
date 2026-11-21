import type { BibleSearchHit } from '@margin/contract/bible/search'

function wordsWithOffsets(text: string) {
	return Array.from(
		text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’‘][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu),
		({ 0: source, index }) => ({
			word: source.replace(/['’‘]/g, '').normalize('NFC').toLowerCase(),
			start: index,
			end: index + source.length,
		}),
	)
}

export const normalizeSearchText = (text: string) =>
	wordsWithOffsets(text)
		.map(({ word }) => word)
		.join(' ')

const searchWords = (text: string) => wordsWithOffsets(text).map(({ word }) => word)

/**
 * Splits a query into terms: each quoted span is one phrase, and outside quotes each
 * space-separated chunk is one term, so "loving-kindness" stays a two-word phrase.
 */
export function parseSearchQuery(query: string) {
	return query.split(/["“”]/u).flatMap((part, index) => {
		const chunks = index % 2 ? [part] : part.split(/\s+/u)
		return chunks.map(searchWords).filter((words) => words.length > 0)
	})
}

export function findSearchMatches({
	text,
	terms,
}: {
	text: string
	terms: string[][]
}): BibleSearchHit['matches'] {
	const words = wordsWithOffsets(text)
	const matched = new Set<number>()
	const byFirstWord = new Map<string, string[][]>()
	for (const term of terms) {
		const first = term[0]
		if (first) byFirstWord.set(first, [...(byFirstWord.get(first) ?? []), term])
	}
	for (const [index, { word }] of words.entries()) {
		for (const term of byFirstWord.get(word) ?? []) {
			if (term.every((value, offset) => words[index + offset]?.word === value))
				for (let offset = 0; offset < term.length; offset++) matched.add(index + offset)
		}
	}
	const ranges: BibleSearchHit['matches'] = []
	for (const [index, { start, end }] of words.entries()) {
		if (!matched.has(index)) continue
		const last = ranges.at(-1)
		// Adjacent matched words read as one wash, as on the canvas.
		if (last && matched.has(index - 1) && !text.slice(last[1], start).trim()) last[1] = end
		else ranges.push([start, end])
	}
	return ranges
}
