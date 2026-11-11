import { Box, createBindingId, createShapeId } from 'tldraw'
import type { Editor, TLShapeId } from 'tldraw'
import type { WordTarget } from '@shared/study/types'
import type { NoteShape, PassageShape } from '../shapes/types'
import { normalizedWordCenter, wordAnchorForElement } from './words'

const NOTE_GAP = 64
const STACK_GAP = 16

/** Right of the passage at the word's height, nudged down past notes already sitting there. */
function notePosition(editor: Editor, passage: PassageShape, wordTop: number, width: number) {
	const bounds = editor.getShapePageBounds(passage)!
	const spot = new Box(bounds.maxX + NOTE_GAP, wordTop, width, 40)
	const taken = editor
		.getCurrentPageShapes()
		.filter((shape) => shape.type === 'margin-note')
		.map((shape) => editor.getShapePageBounds(shape))
		.filter((box): box is Box => !!box)
	for (let tries = 0; tries < 30; tries++) {
		const hits = taken.filter((box) => box.collides(spot))
		if (!hits.length) break
		spot.y = Math.max(...hits.map((box) => box.maxY)) + STACK_GAP
	}
	return { x: spot.x, y: spot.y, passageRight: bounds.maxX }
}

/**
 * Creates a note beside a passage and an arrow from the note to one word, bound at both ends,
 * as a single undo step. Returns the note id.
 */
export function createNoteForWord(
	editor: Editor,
	passage: PassageShape,
	target: WordTarget,
	element: HTMLElement,
	props: Partial<NoteShape['props']>,
	historyLabel: string,
): TLShapeId | null {
	if (!editor.getShapePageBounds(passage)) return null
	const word = element.getBoundingClientRect()
	const point = editor.screenToPage({ x: word.x, y: word.y })
	const { x, y, passageRight } = notePosition(editor, passage, point.y, props.w ?? 180)
	const noteId = createShapeId(),
		arrowId = createShapeId()
	editor.markHistoryStoppingPoint(historyLabel)
	editor.run(() => {
		editor.createShape({ id: noteId, type: 'margin-note', x, y, props })
		editor.createShape({
			id: arrowId,
			type: 'arrow',
			x: passageRight + NOTE_GAP - 16,
			y,
			props: {
				start: { x: 0, y: 20 },
				end: { x: point.x - passageRight - NOTE_GAP + 16, y: point.y - y },
				bend: 28,
			},
		})
		editor.createBinding({
			id: createBindingId(),
			type: 'arrow',
			fromId: arrowId,
			toId: noteId,
			props: {
				terminal: 'start',
				normalizedAnchor: { x: 0, y: 0.15 },
				isPrecise: true,
				isExact: false,
				snap: 'none',
			},
		})
		const arrow = editor.getShape(arrowId)
		const anchor =
			arrow?.type === 'arrow'
				? wordAnchorForElement(editor, arrow, 'end', passage, element)
				: normalizedWordCenter(editor, passage, element)
		editor.createBinding({
			id: createBindingId(),
			type: 'arrow',
			fromId: arrowId,
			toId: passage.id,
			props: {
				terminal: 'end',
				normalizedAnchor: anchor,
				isPrecise: true,
				isExact: true,
				snap: 'none',
			},
			meta: { schemaVersion: 1, target },
		})
	})
	return noteId
}

/** The word an arrow should point at for a selected range: the middle word of the phrase. */
export function phraseAnchorWord(editor: Editor, passageId: string, start: Element, end: Element) {
	const words = [
		...editor
			.getContainer()
			.querySelectorAll<HTMLElement>(`[data-word][data-passage-id="${passageId}"]`),
	]
	const a = words.indexOf(start as HTMLElement),
		b = words.indexOf(end as HTMLElement)
	if (a < 0 || b < 0) return start as HTMLElement
	return words[Math.floor((a + b) / 2)]!
}
