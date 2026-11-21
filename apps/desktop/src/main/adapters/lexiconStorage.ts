import { deflateRawSync } from 'node:zlib'
import type { Token } from '@shared/bible/types'
import type { SourceSpan } from '@shared/lexicon/types'
import { spanText } from '@margin/services/lexicon/storage'
export {
	decodeSpans,
	tokenFingerprint,
	LEXICON_STORAGE_VERSION,
} from '@margin/services/lexicon/storage'

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
