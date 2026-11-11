import { createHash } from 'node:crypto'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { z } from 'zod'
import type { Token, VerseRef } from '../bible/types'
import { strongIdSchema } from './types'
import type { SourceSpan } from './types'

export const LEXICON_STORAGE_VERSION = 2

// Hash the complete token structure, including indices, punctuation, whitespace and italics.
export function tokenFingerprint(tokens: readonly Token[]): string {
	return createHash('sha256').update(JSON.stringify(tokens)).digest('hex').slice(0, 32)
}

const storedSpanSchema = z
	.tuple([
		z.number().int().nonnegative(),
		z.number().int().nonnegative(),
		z.array(strongIdSchema).min(1),
		z.string().optional(),
	])
	.refine(([first, last]) => first <= last)
const storedSpansSchema = z.array(storedSpanSchema)

function spanText(tokens: readonly Token[], first: number, last: number): string {
	return tokens
		.filter((token) => token.i >= first && token.i <= last)
		.map(
			(token, index, words) =>
				token.runs.map((run) => run.text).join('') +
				(index < words.length - 1
					? token.trailing + token.spaceAfter + (words[index + 1]?.leading ?? '')
					: ''),
		)
		.join('')
}

/** Keep exact source text only where it cannot be recovered from the verified snapshot. */
export function encodeSpans(spans: readonly SourceSpan[], tokens: readonly Token[]): Buffer {
	return deflateRawSync(
		Buffer.from(
			JSON.stringify(
				spans.map((span) => {
					const tuple = [span.first, span.last, span.ids]
					return span.text === spanText(tokens, span.first, span.last)
						? tuple
						: [...tuple, span.text]
				}),
			),
		),
	)
}

export function decodeSpans(data: Buffer, ref: VerseRef, tokens: readonly Token[]): SourceSpan[] {
	return storedSpansSchema
		.parse(JSON.parse(inflateRawSync(data).toString('utf8')))
		.map(([first, last, ids, text]) => ({
			ref,
			first,
			last,
			ids,
			text: text ?? spanText(tokens, first, last),
		}))
}
