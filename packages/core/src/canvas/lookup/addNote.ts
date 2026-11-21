import type { Editor } from 'tldraw'
import type { WordTarget } from '@shared/study/types'
import { createNoteForWord } from '../bindings/noteToWord'
import type { PassageShape } from '../shapes/types'

export function addLookupNote(
	editor: Editor,
	passage: PassageShape,
	target: WordTarget,
	element: HTMLElement,
	text: string,
) {
	createNoteForWord(
		editor,
		passage,
		target,
		element,
		{ text, font: 'plain', size: 'S', width: 320, w: 320 },
		'add word lookup note',
	)
}
