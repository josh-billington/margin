import { create } from 'zustand'
import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import type { TagRequest } from '../highlights/tagging'
import { readTextSelection, useTagging, wordFor } from '../highlights/tagging'
import { targetFromElement } from '../bindings/words'
import { highlightAt, wordIndex, wordKey } from '../highlights/ranges'

export const useLookup = create<{
	editor: Editor | null
	request: TagRequest | null
	captured: TagRequest | null
}>(() => ({ editor: null, request: null, captured: null }))

export function caretRequest(editor: Editor): TagRequest | null {
	const element =
		wordFor(window.getSelection()?.anchorNode ?? null) ?? wordFor(document.activeElement)
	if (!element || !editor.getContainer().contains(element) || !element.dataset.passageId)
		return null
	const target = targetFromElement(element)
	const rect = element.getBoundingClientRect()
	return {
		passageId: element.dataset.passageId,
		start: target,
		end: target,
		x: rect.x,
		y: rect.bottom,
	}
}
export function captureLookupSelection(editor: Editor) {
	useLookup.setState({ captured: readTextSelection(editor) ?? caretRequest(editor) })
}
export function requestWordLookup(editor: Editor) {
	const request =
		useLookup.getState().captured ??
		readTextSelection(editor) ??
		caretRequest(editor) ??
		useTagging.getState().captured
	useLookup.setState({ captured: null })
	if (!request || !editor.getCurrentPageShapes().some((shape) => shape.id === request.passageId)) {
		toast.info('Select a scripture word first, then choose Look up word.')
		return
	}
	useTagging.setState({ request: null })
	useLookup.setState({ editor, request: { ...request } })
}

export function installLookupContextMenu(editor: Editor) {
	const container = editor.getContainer()
	const rightDown = (event: PointerEvent) => {
		if (event.button === 2 && wordFor(event.target instanceof Node ? event.target : null)) {
			event.stopPropagation()
			event.preventDefault()
		}
	}
	const contextMenu = (event: MouseEvent) => {
		const element = wordFor(event.target instanceof Node ? event.target : null)
		if (!element) return
		const shape = editor
			.getCurrentPageShapes()
			.find((shape) => shape.id === element.dataset.passageId)
		if (shape?.type !== 'passage') return
		event.preventDefault()
		event.stopPropagation()
		const target = targetFromElement(element)
		let request = readTextSelection(editor)
		const at = wordIndex(shape.props.text, target)
		if (
			!request ||
			request.passageId !== shape.id ||
			at <
				Math.min(
					wordIndex(shape.props.text, request.start),
					wordIndex(shape.props.text, request.end),
				) ||
			at >
				Math.max(
					wordIndex(shape.props.text, request.start),
					wordIndex(shape.props.text, request.end),
				)
		) {
			const highlight = highlightAt(shape.props.text, shape.props.highlights, target)
			request = {
				passageId: shape.id,
				start: highlight?.tagId ? highlight.start : target,
				end: highlight?.tagId ? highlight.end : target,
				x: event.clientX,
				y: event.clientY,
			}
		}
		useLookup.setState({ captured: request })
		const token = shape.props.text.verses.find(
			(verse) =>
				verse.ref.book === target.verse.book &&
				verse.ref.chapter === target.verse.chapter &&
				verse.ref.verse === target.verse.verse,
		)?.tokens[target.token]
		void window.margin.lexicon
			.contextMenu({
				word: token?.runs.map((run) => run.text).join('') ?? '',
				multiple: wordKey(request.start) !== wordKey(request.end),
			})
			.then((result) => {
				if (!result.ok) toast.error(result.error.message)
				if (useLookup.getState().captured === request) useLookup.setState({ captured: null })
			})
	}
	container.addEventListener('pointerdown', rightDown, true)
	container.addEventListener('contextmenu', contextMenu, true)
	return () => {
		container.removeEventListener('pointerdown', rightDown, true)
		container.removeEventListener('contextmenu', contextMenu, true)
		if (useLookup.getState().editor === editor)
			useLookup.setState({ editor: null, request: null, captured: null })
	}
}
