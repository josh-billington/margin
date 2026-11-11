import type { Editor, TLShapeId } from 'tldraw'
import { createNoteForWord, phraseAnchorWord } from '../bindings/noteToWord'
import { targetFromElement } from '../bindings/words'
import { wordFor } from '../highlights/tagging'
import { newNoteProps } from '../shapes/note/newNote'

/**
 * Note with selected words: a new note beside the passage, already joined by an arrow to the
 * selected word (or the middle of a selected phrase), ready to type into. False when no
 * scripture words are selected, so callers fall back to the plain Note tool.
 */
export function noteFromSelection(editor: Editor) {
	const selection = window.getSelection()
	if (!selection || selection.isCollapsed) return false
	const start = wordFor(selection.anchorNode),
		end = wordFor(selection.focusNode)
	const passageId = start?.dataset.passageId
	if (!start || !end || !passageId || passageId !== end.dataset.passageId) return false
	if (!editor.getContainer().contains(start)) return false
	const passage = editor.getShape(passageId as TLShapeId)
	if (passage?.type !== 'passage') return false
	const word = phraseAnchorWord(editor, passageId, start, end)
	const noteId = createNoteForWord(
		editor,
		passage,
		targetFromElement(word),
		word,
		newNoteProps(),
		'note on selected words',
	)
	if (!noteId) return false
	selection.removeAllRanges()
	editor.setCurrentTool('select').select(noteId).setEditingShape(noteId)
	return true
}
