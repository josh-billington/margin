import { tokenize } from '../../src/shared/bible/tokenizer'
import type { Token, VerseRef } from '../../src/shared/bible/types'
import { strongIdSchema } from '../../src/shared/lexicon/types'
import type { SourceSpan } from '../../src/shared/lexicon/types'
import { usfmRuns } from '../import-bible/usfm'

/** Carry tag boundaries through the display importer's cleanup, then use its unchanged tokens. */
export function annotatedTokens(ref: VerseRef, source: string) {
	const tags: { text: string; ids: string[]; start: number; end: number }[] = []
	const marked = source.replace(
		/\\\+?w\s+([^|]*?)\|([^\\]*)\\\+?w\*/g,
		(_all, text: string, attributes: string) => {
			const ids = [...(attributes.match(/strong="([^"]*)"/)?.[1] ?? '').matchAll(/[HG]\d+/g)].map(
				(match) => strongIdSchema.parse(match[0]),
			)
			const index = tags.push({ text, ids: [...new Set(ids)], start: -1, end: -1 }) - 1
			return `\uE000${index}s\uE001${text}\uE000${index}e\uE001`
		},
	)
	let offset = 0
	const runs = usfmRuns(marked).map((run) => {
		let cursor = 0
		let text = ''
		for (const match of run.text.matchAll(/\uE000(\d+)([se])\uE001/g)) {
			text += run.text.slice(cursor, match.index)
			const tag = tags[Number(match[1])]
			if (!tag) throw new Error('Invalid annotation boundary')
			if (match[2] === 's') tag.start = offset + text.length
			else tag.end = offset + text.length
			cursor = match.index + match[0].length
		}
		text += run.text.slice(cursor)
		offset += text.length
		return { ...run, text }
	})
	const tokens = tokenize(runs)
	let position = 0
	const bounds = tokens.map((token) => {
		position += token.leading.length
		const start = position
		position += token.runs.reduce((n, run) => n + run.text.length, 0)
		const end = position
		position += token.trailing.length + token.spaceAfter.length
		return { start, end, token: token.i }
	})
	const spans: SourceSpan[] = []
	for (const tag of tags) {
		if (!tag.ids.length) continue
		const words = bounds.filter((word) => word.start < tag.end && word.end > tag.start)
		const first = words[0],
			last = words.at(-1)
		if (!first || !last || tag.start < 0 || tag.end < tag.start)
			throw new Error(`Unmapped annotation ${JSON.stringify(ref)}: ${tag.text}`)
		spans.push({ ref, first: first.token, last: last.token, text: tag.text, ids: tag.ids })
	}
	return { tokens, spans }
}

export function assertTokenEquality(actual: Token[], expected: Token[], label: string) {
	if (JSON.stringify(actual) !== JSON.stringify(expected))
		throw new Error(`Lexicon token mismatch at ${label}; Bible DB was not modified.`)
}
