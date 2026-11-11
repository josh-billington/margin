import { describe, expect, it } from 'vitest'
import { formatScriptureCopy } from './copy'
import { translationLockReason } from './lock'

const verse = (n: number) => ({ book: 'AMO' as const, chapter: 1, verse: n })
describe('formatScriptureCopy', () => {
	it('appends reference and translation to the selected words', () => {
		const words = [
			{ text: 'Thus', spaceAfter: ' ', verse: verse(3) },
			{ text: 'saith', spaceAfter: ' ', verse: verse(3) },
			{ text: 'For', spaceAfter: ' ', verse: verse(4) },
		]
		expect(formatScriptureCopy(words, 'King James Version')).toBe(
			'Thus saith For\n— Amos 1:3–4, King James Version',
		)
	})
	it('uses a single verse label and is empty without words', () => {
		expect(formatScriptureCopy([{ text: 'Thus', spaceAfter: '', verse: verse(3) }], 'KJV')).toBe(
			'Thus\n— Amos 1:3, KJV',
		)
		expect(formatScriptureCopy([], 'KJV')).toBe('')
	})
})
describe('translationLockReason', () => {
	it('is null when unannotated and names what locks otherwise', () => {
		expect(translationLockReason({ highlights: 0, wordArrows: 0 })).toBeNull()
		expect(translationLockReason({ highlights: 2, wordArrows: 1 })).toContain(
			'2 highlights and 1 word-bound arrow',
		)
	})
})
