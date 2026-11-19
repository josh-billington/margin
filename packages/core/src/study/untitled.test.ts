import { expect, it } from 'vitest'
import { untitledTitle } from './untitled'

it('names the first new study "Untitled study"', () => {
	expect(untitledTitle([])).toBe('Untitled study')
	expect(untitledTitle(['Romans', 'Untitled study 2'])).toBe('Untitled study')
})

it('numbers the next ones against existing titles', () => {
	expect(untitledTitle(['Untitled study'])).toBe('Untitled study 2')
	expect(untitledTitle(['Untitled study', 'Untitled study 2'])).toBe('Untitled study 3')
	expect(untitledTitle(['untitled study ', 'Untitled study 3'])).toBe('Untitled study 2')
})
