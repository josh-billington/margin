import { react } from 'tldraw'
import type { Editor } from 'tldraw'
import {
	interactiveSurfaceSelector,
	openPopoverSelector,
	shortcutsSuppressed,
} from '../shortcutContext'
import type { ShortcutContext } from '../shortcutContext'
import { duplicateSelection, requestDeleteSelection } from '../annotations/editorOps'
import { requestTagSelection } from '../highlights/tagging'
import { clearTagFocus, useTagFocus } from '../tags/tagFocus'

const SUPPRESS_MENU = 'margin-text-priority'

export function shortcutContext(editor: Editor, event?: KeyboardEvent): ShortcutContext {
	const target = event?.target ?? document.activeElement
	return {
		isComposing: event?.isComposing ?? false,
		keyCode: event?.keyCode,
		editingShape: editor.getEditingShapeId() !== null,
		inInteractiveSurface: target instanceof Element && !!target.closest(interactiveSurfaceSelector),
		popoverOpen: !!document.querySelector(openPopoverSelector),
		textSelected: !(window.getSelection()?.isCollapsed ?? true),
	}
}

const isVisible = (editor: Editor) =>
	getComputedStyle(editor.getContainer()).visibility !== 'hidden'

/**
 * SPEC §6.1. tldraw's own shortcuts (arrows, Delete, letters) honour open menus, so a
 * synthetic open menu keeps them out while a popover, text field, IME composition or
 * text selection owns the keyboard. Margin's shortcuts consult the same context.
 */
export function installShortcuts(editor: Editor) {
	let composing = false
	const sync = () => {
		if (!isVisible(editor)) return editor.menus.deleteOpenMenu(SUPPRESS_MENU)
		const suppressed = shortcutsSuppressed({ ...shortcutContext(editor), isComposing: composing })
		if (suppressed) editor.menus.addOpenMenu(SUPPRESS_MENU)
		else editor.menus.deleteOpenMenu(SUPPRESS_MENU)
	}
	const onCompose = (event: Event) => {
		composing = event.type === 'compositionstart'
		sync()
	}
	const onKeyDown = (event: KeyboardEvent) => {
		if (!isVisible(editor)) return
		const mod = event.metaKey || event.ctrlKey
		if (mod && event.shiftKey && event.key.toLowerCase() === 'h') {
			event.preventDefault()
			event.stopImmediatePropagation()
			requestTagSelection(editor)
			return
		}
		if (event.isComposing || event.keyCode === 229) return
		if (event.key === 'Escape' && useTagFocus.getState().tagId) {
			const surface = shortcutContext(editor, event)
			if (!surface.inInteractiveSurface && !surface.popoverOpen && !surface.editingShape) {
				clearTagFocus()
				event.stopImmediatePropagation()
			}
			return
		}
		sync()
		if (shortcutsSuppressed(shortcutContext(editor, event))) return
		if (mod && !event.shiftKey && event.key.toLowerCase() === 'd') {
			event.preventDefault()
			event.stopImmediatePropagation()
			duplicateSelection(editor)
		} else if (
			!mod &&
			!event.altKey &&
			!event.shiftKey &&
			(event.key === 'Delete' || event.key === 'Backspace') &&
			editor.getSelectedShapeIds().length
		) {
			event.preventDefault()
			event.stopImmediatePropagation()
			requestDeleteSelection(editor)
		}
	}
	// Ending a text edit (Esc, blur) fires no key or focus event after the commit; without this the
	// synthetic menu lingers and tldraw's click-capture layer swallows the next canvas click.
	const stopEditingWatch = react('margin shortcut suppression', () => {
		editor.getEditingShapeId()
		sync()
	})
	const observer = new MutationObserver(sync)
	observer.observe(document.body, { childList: true })
	document.addEventListener('selectionchange', sync)
	document.addEventListener('focusin', sync)
	// Focus leaving to <body> (a textarea blurring) fires no focusin; re-check once it has settled.
	const onFocusOut = () => setTimeout(sync, 0)
	document.addEventListener('focusout', onFocusOut)
	document.addEventListener('compositionstart', onCompose, true)
	document.addEventListener('compositionend', onCompose, true)
	document.addEventListener('keydown', onKeyDown, true)
	return () => {
		stopEditingWatch()
		observer.disconnect()
		document.removeEventListener('selectionchange', sync)
		document.removeEventListener('focusin', sync)
		document.removeEventListener('focusout', onFocusOut)
		document.removeEventListener('compositionstart', onCompose, true)
		document.removeEventListener('compositionend', onCompose, true)
		document.removeEventListener('keydown', onKeyDown, true)
		editor.menus.deleteOpenMenu(SUPPRESS_MENU)
	}
}
