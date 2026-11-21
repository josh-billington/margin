import type { PassageText } from '../bible/types'
import type { Highlight, WordTarget } from './types'

const key = (target: WordTarget) =>
	`${target.verse.book}.${target.verse.chapter}.${target.verse.verse}:${target.token}`

/** Word order of a snapshot, mapping each word key to its reading-order index. */
export function snapshotIndex(text: PassageText) {
	const index = new Map<string, number>()
	for (const verse of text.verses)
		for (const token of verse.tokens)
			index.set(key({ verse: verse.ref, token: token.i }), index.size)
	return index
}

export interface InvalidHighlight {
	highlight: Highlight
	reason: string
}

export const isValidWordTarget = (text: PassageText, target: WordTarget) =>
	snapshotIndex(text).has(key(target))

/**
 * SPEC §7.4: every highlight must resolve inside its owning snapshot, run in order,
 * and not overlap another highlight. Invalid records are returned, never repaired.
 */
export function validateHighlights(text: PassageText, highlights: readonly Highlight[]) {
	const index = snapshotIndex(text)
	const valid: Highlight[] = []
	const invalid: InvalidHighlight[] = []
	const taken: [number, number][] = []
	for (const highlight of highlights) {
		const start = index.get(key(highlight.start)),
			end = index.get(key(highlight.end))
		let reason: string | undefined
		if (start === undefined || end === undefined) reason = 'Target word is absent from the snapshot'
		else if (start > end) reason = 'Range is out of order'
		else if (taken.some(([lo, hi]) => start <= hi && end >= lo)) reason = 'Range overlaps another'
		if (reason || start === undefined || end === undefined) {
			invalid.push({ highlight, reason: reason ?? 'Invalid range' })
			continue
		}
		taken.push([start, end])
		valid.push(highlight)
	}
	return { valid, invalid }
}
