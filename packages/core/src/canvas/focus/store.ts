import { create } from 'zustand'
import { atom } from 'tldraw'
import type { Editor } from 'tldraw'
import type { Camera } from './camera'
import type { FocusTarget } from './dimming'

/** Bumped after a passage block lays out, so values measured from the DOM recompute. */
export const passageLayout = atom('passage layout', 0)

/** Temporary reading state (SPEC §5). Never written to shape props or document history. */
export interface FocusState {
	/** The study canvas that owns the focus; other studies' canvases are unaffected. */
	editor: Editor | null
	target: FocusTarget | null
	/** Camera to restore when leaving passage focus. Survives switching to another passage. */
	canvasCamera: Camera | null
	/** Camera to restore when leaving verse focus. */
	passageCamera: Camera | null
}
export const useFocus = create<FocusState>(() => ({
	editor: null,
	target: null,
	canvasCamera: null,
	passageCamera: null,
}))
export const resetFocus = () =>
	useFocus.setState({ editor: null, target: null, canvasCamera: null, passageCamera: null })
export const focusFor = (editor: Editor) => {
	const state = useFocus.getState()
	return state.editor === editor ? state : null
}
