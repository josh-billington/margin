import { expect, it, vi } from 'vitest'
import { noteFontChoice, noteFontPreferences } from './preferences'
import type { NoteFontChoice } from './preferences'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

it('reads every stored combination of the two note preferences as one choice', () => {
	const read = (defaultNoteFont: 'handwritten' | 'plain', displayNotesInPlainFont: boolean) =>
		noteFontChoice({ defaultNoteFont, displayNotesInPlainFont })
	expect(read('handwritten', false)).toBe('handwritten')
	expect(read('plain', false)).toBe('system-new')
	expect(read('plain', true)).toBe('system-all')
	expect(read('handwritten', true)).toBe('system-all')
})

it('writes each choice so it reads back the same', () => {
	for (const choice of ['handwritten', 'system-new', 'system-all'] as NoteFontChoice[])
		for (const from of [
			{ defaultNoteFont: 'handwritten', displayNotesInPlainFont: false },
			{ defaultNoteFont: 'plain', displayNotesInPlainFont: true },
		] as const)
			expect(noteFontChoice({ ...from, ...noteFontPreferences(choice) })).toBe(choice)
})
