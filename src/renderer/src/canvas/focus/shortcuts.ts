import type { Editor } from 'tldraw'
import { shortcutsSuppressed } from '../shortcutContext'
import { shortcutContext } from '../tools/shortcuts'
import {
	exitFocusLevel,
	activeVerse,
	focusPassage,
	moveCamera,
	pullOutVerse,
	stepVerse,
} from './actions'
import { centerOn, fitCamera } from './camera'
import { focusFor } from './store'

/** Fit-all / fit-selection never magnify past this (a lone note would otherwise fill the screen). */
const FIT_MAX_ZOOM = 2
const isVisible = (editor: Editor) =>
	getComputedStyle(editor.getContainer()).visibility !== 'hidden'

export function fitAll(editor: Editor) {
	const bounds = editor.getCurrentPageBounds()
	if (!bounds) return
	moveCamera(editor, fitCamera(viewport(editor), bounds, 48, FIT_MAX_ZOOM))
}
function fitSelection(editor: Editor) {
	const bounds = editor.getSelectionPageBounds()
	if (!bounds) return
	moveCamera(editor, fitCamera(viewport(editor), bounds, 48, FIT_MAX_ZOOM))
}
export function zoomTo100(editor: Editor) {
	moveCamera(editor, centerOn(viewport(editor), editor.getViewportPageBounds().center, 1))
}
const viewport = (editor: Editor) => {
	const { w, h } = editor.getViewportScreenBounds()
	return { w, h }
}

const swallow = (event: KeyboardEvent) => {
	event.preventDefault()
	event.stopImmediatePropagation()
}

/**
 * SPEC §5 and §6.1: F / ⇧F / Esc / ↑ ↓ and ⌘0 ⌘1 ⌘2. Text fields, note editors, text selection,
 * IME composition and popovers keep their keys; Esc ends those before changing reading focus.
 */
export function installFocusShortcuts(editor: Editor) {
	const onKeyDown = (event: KeyboardEvent) => {
		if (!isVisible(editor) || event.isComposing || event.keyCode === 229) return
		const context = shortcutContext(editor, event)
		const mod = event.metaKey || event.ctrlKey
		if (mod && !event.shiftKey && !event.altKey && ['0', '1', '2'].includes(event.key)) {
			if (context.inInteractiveSurface || context.editingShape || context.popoverOpen) return
			swallow(event)
			if (event.key === '0') fitAll(editor)
			else if (event.key === '1') zoomTo100(editor)
			else fitSelection(editor)
			return
		}
		if (mod || event.altKey) return
		const focus = focusFor(editor)
		if (event.key === 'Escape') {
			if (!focus?.target) return
			if (context.editingShape || context.inInteractiveSurface || context.popoverOpen) return
			if (context.textSelected) {
				// A text interaction ends first; the next Esc steps back.
				window.getSelection()?.removeAllRanges()
				swallow(event)
				return
			}
			if (exitFocusLevel(editor)) swallow(event)
			return
		}
		if (shortcutsSuppressed(context)) return
		const key = event.key.toLowerCase()
		if (key === 'f' && !event.shiftKey) {
			const selected = editor.getOnlySelectedShape()
			if (selected?.type !== 'passage') return
			swallow(event)
			focusPassage(editor, selected.id)
		} else if (key === 'f' && event.shiftKey) {
			const passageId = focus?.target?.passageId
			const verse = passageId ? activeVerse(editor, passageId) : null
			if (!passageId || !verse) return
			swallow(event)
			pullOutVerse(editor, passageId, verse)
		} else if (
			(event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
			!event.shiftKey &&
			focus?.target
		) {
			swallow(event)
			stepVerse(editor, event.key === 'ArrowDown' ? 1 : -1)
		}
	}
	document.addEventListener('keydown', onKeyDown, true)
	return () => document.removeEventListener('keydown', onKeyDown, true)
}
