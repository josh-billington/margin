import { expect, it } from 'vitest'
import type { VerseRef } from '@shared/bible/types'
import { blockTitle, formatRange } from './labels'

const ref = (chapter: number, verse: number): VerseRef => ({ book: 'PSA', chapter, verse })

it('labels one psalm in the singular, as the canvas header and sidebar show it', () => {
	expect(formatRange({ start: ref(25, 6), end: ref(25, 6) })).toBe('Psalm 25:6')
	expect(blockTitle([{ start: ref(23, 1), end: ref(23, 6) }], 'kjv')).toBe('Psalm 23 · KJV')
	expect(blockTitle([{ start: ref(23, 1), end: ref(24, 10) }], 'kjv')).toBe('Psalms 23–24 · KJV')
})
