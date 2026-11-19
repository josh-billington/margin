import { z } from 'zod'
import { tokenize } from './tokenizer'
import type { TextRun } from './tokenizer'
import type { Token } from './types'

/**
 * Version of the bundled SQLite layout. Version 2 stores each verse as its italic-annotated
 * text; tokens are re-derived with the tokenizer named by the edition's tokenizerVersion.
 */
export const STORAGE_VERSION = 2

const storedRunsSchema = z.array(z.tuple([z.string(), z.union([z.literal(0), z.literal(1)])]))

/**
 * Serializes a verse's tokens as `[text, italic]` runs. Punctuation and whitespace never affect
 * tokenization, so their italic flag is written as roman; only word characters keep their flags.
 */
export function encodeVerseRuns(tokens: readonly Token[]): string {
	const runs: [string, 0 | 1][] = []
	const push = (text: string, italic: 0 | 1) => {
		if (!text) return
		const last = runs.at(-1)
		if (last && last[1] === italic) last[0] += text
		else runs.push([text, italic])
	}
	for (const token of tokens) {
		push(token.leading, 0)
		for (const run of token.runs) push(run.text, run.italic ? 1 : 0)
		push(token.trailing, 0)
		push(token.spaceAfter, 0)
	}
	return JSON.stringify(runs)
}

/** Rebuilds a verse's tokens from its stored runs with the bundled tokenizer. */
export function decodeVerseTokens(stored: string): Token[] {
	const runs: TextRun[] = storedRunsSchema
		.parse(JSON.parse(stored))
		.map(([text, italic]) => ({ text, italic: italic === 1 }))
	return tokenize(runs)
}
