import type { Editor } from 'tldraw'

/**
 * tldraw only hears keys while focus is inside its container, so after a dialog closes (focus lands
 * on <body>) holding Space would do nothing. Hand Space back to the canvas so it pans as expected.
 */
export function installSpacePan(editor: Editor) {
	const doc = editor.getContainer().ownerDocument
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.code !== 'Space' || event.repeat) return
		if (event.metaKey || event.ctrlKey || event.altKey) return
		if (event.target !== doc.body && event.target !== doc.documentElement) return
		event.preventDefault()
		editor.focus()
		editor.dispatch({
			type: 'keyboard',
			name: 'key_down',
			key: event.key,
			code: event.code,
			shiftKey: event.shiftKey,
			altKey: false,
			ctrlKey: false,
			metaKey: false,
			accelKey: false,
		})
	}
	doc.addEventListener('keydown', onKeyDown, true)
	return () => doc.removeEventListener('keydown', onKeyDown, true)
}
