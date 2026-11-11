import { create } from 'zustand'
import { toast } from 'sonner'
import type { Editor, TLShapeId } from 'tldraw'
import type { WordTarget } from '@shared/study/types'
import { targetFromElement } from '../bindings/words'

export interface TagRequest {
	passageId: string
	start: WordTarget
	end: WordTarget
	x: number
	y: number
}
interface TaggingState {
	request: TagRequest | null
	/** Selection captured before focus moved to the palette or a control. */
	captured: TagRequest | null
}
export const useTagging = create<TaggingState>(() => ({ request: null, captured: null }))

export const wordFor = (node: Node | null) =>
	(node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>('[data-word]') ??
	null

/** Reads the live text selection as a whole-word range inside one passage. */
export function readTextSelection(editor: Editor): TagRequest | null {
	const selection = window.getSelection()
	if (!selection || selection.isCollapsed) return null
	const start = wordFor(selection.anchorNode),
		end = wordFor(selection.focusNode)
	const passageId = start?.dataset.passageId
	if (
		!start ||
		!end ||
		!passageId ||
		passageId !== end.dataset.passageId ||
		!editor.getContainer().contains(start)
	)
		return null
	const rect = end.getBoundingClientRect()
	return {
		passageId,
		start: targetFromElement(start),
		end: targetFromElement(end),
		x: rect.x,
		y: rect.bottom,
	}
}
export const captureTextSelection = (editor: Editor) =>
	useTagging.setState({ captured: readTextSelection(editor) })

/** Tag selection: toolbar, command palette and shortcut all land here. */
export function requestTagSelection(editor: Editor) {
	const request = readTextSelection(editor) ?? useTagging.getState().captured
	useTagging.setState({ captured: null })
	if (!request || !editor.getShape(request.passageId as TLShapeId)) {
		toast.info('Select some scripture words first, then choose Tag selected words.')
		return false
	}
	useTagging.setState({ request })
	return true
}
