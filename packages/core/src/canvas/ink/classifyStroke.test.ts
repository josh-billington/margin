import { expect, it } from 'vitest'
import { createShapeId } from 'tldraw'
import type { InkStroke } from '@shared/study/types'
import { classifyStroke, type StrokeTarget } from './classifyStroke'

const passage = { id: createShapeId('passage') }
const otherPassage = { id: createShapeId('other-passage') }
const word = {
	kind: 'word',
	shape: passage,
	word: { verse: { book: 'AMO', chapter: 1, verse: 3 }, token: 0 },
} satisfies StrokeTarget
const nextWord = { ...word, word: { ...word.word, token: 1 } }
const sameWordOtherBlock = { ...word, shape: otherPassage }
const block = { kind: 'block', shape: passage } satisfies StrokeTarget
const otherBlock = { ...block, shape: otherPassage }
const note = { kind: 'note', shape: { id: createShapeId('note') } } satisfies StrokeTarget
const otherNote = { ...note, shape: { id: createShapeId('other-note') } }

const origin = { x: 0, y: 0, z: 0.5 }
const line: InkStroke = [origin, { ...origin, x: 50 }]

function classify({
	start,
	end,
	points = line,
	zoom = 1,
	staysInStartNote = false,
}: {
	start?: StrokeTarget
	end?: StrokeTarget
	points?: InkStroke
	zoom?: number
	staysInStartNote?: boolean
}) {
	return classifyStroke({ start, end, points, zoom, staysInStartNote })
}

it('keeps a loop or dot inside one note as handwriting', () => {
	for (const points of [[origin], [origin, { ...origin, x: 12 }, origin]] satisfies InkStroke[]) {
		expect(classify({ start: note, end: note, points, staysInStartNote: true })).toEqual({
			kind: 'handwriting',
			noteId: note.shape.id,
		})
	}
})

it('keeps a stroke that leaves and re-enters the same note on the canvas', () => {
	expect(classify({ start: note, end: note })).toEqual({ kind: 'ink' })
})

it.each([
	{ label: 'distinct words in one block', start: word, end: nextWord },
	{ label: 'the same scripture word in different blocks', start: word, end: sameWordOtherBlock },
	{ label: 'word to its own block', start: word, end: block },
	{ label: 'block to word', start: block, end: sameWordOtherBlock },
	{ label: 'block to block', start: block, end: otherBlock },
	{ label: 'note to word', start: note, end: word },
	{ label: 'word to note', start: word, end: note },
	{ label: 'note to block', start: note, end: block },
	{ label: 'block to note', start: block, end: note },
	{ label: 'note to note', start: note, end: otherNote },
])('binds $label', ({ start, end }) => {
	expect(classify({ start, end })).toEqual({ kind: 'arrow', start, end })
})

it.each([
	{ label: 'the same word by value', start: word, end: { ...word, word: { ...word.word } } },
	{ label: 'the same block', start: block, end: block },
	{ label: 'an empty start', end: word },
	{ label: 'an empty end', start: note },
	{ label: 'two empty ends' },
])('keeps $label as plain ink', ({ start, end }) => {
	expect(classify({ start, end })).toEqual({ kind: 'ink' })
})

it('keeps loops and retraced underlines plain even across different targets', () => {
	const loop: InkStroke = [
		origin,
		{ ...origin, y: 30 },
		{ ...origin, x: 12, y: 30 },
		{ ...origin, x: 12 },
	]
	const underline: InkStroke = [origin, { ...origin, x: 80 }, { ...origin, x: 15 }]
	for (const zoom of [0.25, 1, 4]) {
		for (const points of [loop, underline])
			expect(classify({ start: word, end: nextWord, points, zoom })).toEqual({ kind: 'ink' })
	}
})

it('uses six screen pixels for short strokes regardless of canvas zoom', () => {
	for (const zoom of [0.25, 1, 4]) {
		for (const distance of [0, 6, 6.1]) {
			const points: InkStroke = [origin, { ...origin, x: distance / zoom }]
			expect(classify({ start: word, end: nextWord, points, zoom }).kind).toBe(
				distance <= 6 ? 'ink' : 'arrow',
			)
		}
	}
})

it('compares the chord with the travelled path, including the ratio boundary', () => {
	const points: InkStroke = [origin, { ...origin, x: 60 }, { ...origin, x: 20 }]
	expect(classify({ start: word, end: nextWord, points }).kind).toBe('ink')
	points[2] = { ...origin, x: 21 }
	expect(classify({ start: word, end: nextWord, points }).kind).toBe('arrow')
	expect(classify({ start: word, end: nextWord, points: [origin] }).kind).toBe('ink')
})
