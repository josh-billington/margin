export interface ShortcutContext {
	isComposing: boolean
	keyCode?: number
	editingShape: boolean
	/** Target is inside a text field, dialog, popover, or menu. */
	inInteractiveSurface: boolean
	popoverOpen: boolean
	textSelected: boolean
}

/** SPEC §6.1: these contexts keep arrows, letters and Delete for themselves. */
export const shortcutsSuppressed = (c: ShortcutContext) =>
	c.isComposing ||
	c.keyCode === 229 ||
	c.editingShape ||
	c.inInteractiveSurface ||
	c.popoverOpen ||
	c.textSelected

export const interactiveSurfaceSelector =
	'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]'
export const openPopoverSelector =
	'[role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]'

/** Keys that tldraw would otherwise treat as canvas shortcuts. */
export const isCanvasShortcutKey = (event: {
	key: string
	metaKey: boolean
	ctrlKey: boolean
	altKey: boolean
}) => {
	if (event.metaKey || event.ctrlKey)
		return event.key.toLowerCase() === 'd' || event.key.toLowerCase() === 'a'
	return (
		/^[a-z0-9]$/i.test(event.key) ||
		event.key === 'Delete' ||
		event.key === 'Backspace' ||
		event.key.startsWith('Arrow')
	)
}
