import type { Token } from './types'

export const TOKENIZER_VERSION = '1'
export type TextRun = Token['runs'][number]

/** A word includes internal apostrophes and hyphens, never a verse boundary. */
export function tokenize(input: string | readonly TextRun[]): Token[] {
	const runs = typeof input === 'string' ? [{ text: input, italic: false }] : input
	const text = runs.map((run) => run.text).join('')
	const flags = runs.flatMap((run) => Array.from({ length: run.text.length }, () => run.italic))
	const words = [...text.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’‘\-‐‑][\p{L}\p{M}\p{N}]+)*/gu)]
	const tokens: Token[] = []
	let pending = text.slice(0, words[0]?.index ?? text.length)
	for (let index = 0; index < words.length; index++) {
		const word = words[index]
		if (!word) continue
		const start = word.index
		const end = start + word[0].length
		const next = words[index + 1]
		const gap = text.slice(end, next?.index ?? text.length)
		// Opening punctuation belongs to the next word, including without an intervening space.
		const split = next ? /^(.*?)(\s*)([“‘"'([{]*)$/su.exec(gap) : null
		const trailing = split ? (split[1] ?? '') : gap.replace(/\s+$/u, '')
		const spaceAfter = split ? (split[2] ?? '') : (gap.match(/\s+$/u)?.[0] ?? '')
		const wordRuns: TextRun[] = []
		for (let position = start; position < end; position++) {
			const italic = flags[position] ?? false
			const last = wordRuns.at(-1)
			if (last && last.italic === italic) last.text += text[position]
			else wordRuns.push({ text: text[position] ?? '', italic })
		}
		tokens.push({ i: index, leading: pending, runs: wordRuns, trailing, spaceAfter })
		pending = split?.[3] ?? ''
	}
	return tokens
}

export function tokensToText(tokens: readonly Token[]): string {
	return tokens
		.map(
			(token) =>
				token.leading +
				token.runs.map((run) => run.text).join('') +
				token.trailing +
				token.spaceAfter,
		)
		.join('')
}
