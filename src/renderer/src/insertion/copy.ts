import type { VerseRef } from '@shared/bible/types'
import { formatRange } from './labels'

export interface CopiedWord {
	text: string
	spaceAfter: string
	verse: VerseRef
}

/** Selected scripture words followed by their reference and the translation name (SPEC §6.2). */
export function formatScriptureCopy(words: readonly CopiedWord[], editionName: string): string {
	if (!words.length) return ''
	const body = words
		.map((word, i) => word.text + (i < words.length - 1 ? word.spaceAfter || ' ' : ''))
		.join('')
		.trim()
	const reference = formatRange({ start: words[0]!.verse, end: words.at(-1)!.verse })
	return `${body}\n— ${reference}, ${editionName}`
}
