import { hasher, codec } from '../codecs'
import type { Hasher, Codec } from '../ports'
import { z } from 'zod'
import type { Token, VerseRef } from '@margin/contract/bible/types'
import { strongIdSchema } from '@margin/contract/lexicon/types'
import type { SourceSpan } from '@margin/contract/lexicon/types'

export const LEXICON_STORAGE_VERSION = 2

// Hash the complete token structure, including indices, punctuation, whitespace and italics.
export function tokenFingerprint(tokens: readonly Token[], hash: Hasher = hasher): string {
	return hash.sha256Hex(JSON.stringify(tokens)).slice(0, 32)
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

export function spanText(tokens: readonly Token[], first: number, last: number): string {
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

export function decodeSpans(
	data: Uint8Array,
	ref: VerseRef,
	tokens: readonly Token[],
	decoder: Codec = codec,
): SourceSpan[] {
	return storedSpansSchema
		.parse(JSON.parse(new TextDecoder().decode(decoder.inflateRaw(data))))
		.map(([first, last, ids, text]) => ({
			ref,
			first,
			last,
			ids,
			text: text ?? spanText(tokens, first, last),
		}))
}
