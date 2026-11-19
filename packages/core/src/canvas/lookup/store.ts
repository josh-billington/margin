import { create } from 'zustand'
import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import type { TagRequest } from '../highlights/tagging'
import { readTextSelection, useTagging, wordFor } from '../highlights/tagging'
import { targetFromElement } from '../bindings/words'
import { wordKey } from '../highlights/ranges'
import { contextLookupRequest } from './contextRange'
import { createLongPress } from '../../lib/gestures'

export const useLookup = create<{
	editor: Editor | null
	request: TagRequest | null
	captured: TagRequest | null
	menu: WordMenu | null
}>(() => ({ editor: null, request: null, captured: null, menu: null }))

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
		toast.info('Select a word in a verse, then choose Look up word.')
		return
	}
	useTagging.setState({ request: null })
	useLookup.setState({ editor, request: { ...request } })
}

/** The in-page word menu a host without native context menus shows on long-press or right-click. */
export interface WordMenu {
	request: TagRequest
	/** The word shown in "Look up “word”"; empty for a selection of several words. */
	word: string
}

/** What a context gesture on this word acts on, as the native menu describes it. */
function contextTarget(editor: Editor, element: HTMLElement, point: { x: number; y: number }) {
	const shape = editor
		.getCurrentPageShapes()
		.find((shape) => shape.id === element.dataset.passageId)
	if (shape?.type !== 'passage') return null
	const target = targetFromElement(element)
	const request = contextLookupRequest(
		shape.props.text,
		shape.id,
		readTextSelection(editor),
		target,
		point,
	)
	const token = shape.props.text.verses.find(
		(verse) =>
			verse.ref.book === target.verse.book &&
			verse.ref.chapter === target.verse.chapter &&
			verse.ref.verse === target.verse.verse,
	)?.tokens[target.token]
	return {
		request,
		word: token?.runs.map((run) => run.text).join('') ?? '',
		multiple: wordKey(request.start) !== wordKey(request.end),
	}
}
const wordAt = (target: EventTarget | null) => wordFor(target instanceof Node ? target : null)

export function installLookupContextMenu(
	editor: Editor,
	{ nativeContextMenu }: { nativeContextMenu: boolean },
) {
	const container = editor.getContainer()
	const openWordMenu = (element: HTMLElement, point: { x: number; y: number }) => {
		const context = contextTarget(editor, element, point)
		if (!context) return false
		useLookup.setState({
			editor,
			menu: { request: context.request, word: context.multiple ? '' : context.word },
		})
		return true
	}
	// The held word shows the press at once, as iOS does, instead of waiting for the menu (touch.css).
	let pressed: HTMLElement | null = null
	const longPress = createLongPress({
		delay: editor.options.longPressDurationMs,
		slop: 10,
		onLongPress: ({ x, y }) => {
			const element = wordAt(document.elementFromPoint(x, y))
			if (element && editor.getCurrentToolId() === 'select') openWordMenu(element, { x, y })
		},
		onPressStart: ({ x, y }) => {
			pressed = wordAt(document.elementFromPoint(x, y))
			pressed?.setAttribute('data-pressed', '')
		},
		onPressEnd: () => {
			pressed?.removeAttribute('data-pressed')
			pressed = null
		},
	})
	const touchDown = (event: PointerEvent) => {
		if (event.pointerType === 'mouse' || !event.isPrimary) return longPress.cancel()
		if (editor.getCurrentToolId() !== 'select' || !wordAt(event.target)) return
		longPress.down({ pointerId: event.pointerId, x: event.clientX, y: event.clientY })
	}
	const touchMove = (event: PointerEvent) =>
		longPress.move({ pointerId: event.pointerId, x: event.clientX, y: event.clientY })
	// The menu is open by now; the lift that ends the press must not also tap the word.
	const touchUp = (event: PointerEvent) => {
		if (!longPress.up(event.pointerId)) return
		event.stopPropagation()
		event.preventDefault()
	}
	const rightDown = (event: PointerEvent) => {
		if (event.button === 2 && wordAt(event.target)) {
			event.stopPropagation()
			event.preventDefault()
		}
	}
	const contextMenu = (event: MouseEvent) => {
		const element = wordAt(event.target)
		if (!element) return
		if (!nativeContextMenu) {
			// A touch long-press also raises contextmenu; the press already opened the menu.
			if (
				useLookup.getState().menu ||
				openWordMenu(element, { x: event.clientX, y: event.clientY })
			)
				event.preventDefault()
			return
		}
		const context = contextTarget(editor, element, { x: event.clientX, y: event.clientY })
		if (!context) return
		event.preventDefault()
		event.stopPropagation()
		const { request } = context
		useLookup.setState({ captured: request })
		void window.margin.lexicon
			.contextMenu({ word: context.word, multiple: context.multiple })
			.then((result) => {
				if (!result.ok) toast.error(result.error.message)
				if (useLookup.getState().captured === request) useLookup.setState({ captured: null })
			})
	}
	container.addEventListener('pointerdown', rightDown, true)
	container.addEventListener('contextmenu', contextMenu, true)
	if (!nativeContextMenu) {
		container.addEventListener('pointerdown', touchDown, true)
		container.addEventListener('pointermove', touchMove, true)
		container.addEventListener('pointerup', touchUp, true)
		container.addEventListener('pointercancel', longPress.cancel, true)
	}
	return () => {
		longPress.cancel()
		container.removeEventListener('pointerdown', rightDown, true)
		container.removeEventListener('contextmenu', contextMenu, true)
		container.removeEventListener('pointerdown', touchDown, true)
		container.removeEventListener('pointermove', touchMove, true)
		container.removeEventListener('pointerup', touchUp, true)
		container.removeEventListener('pointercancel', longPress.cancel, true)
		if (useLookup.getState().editor === editor)
			useLookup.setState({ editor: null, request: null, captured: null, menu: null })
	}
}
