import type { AppCommandId } from '@shared/ipc/commands'
import { captureLookupSelection, requestWordLookup } from '../canvas/lookup/store'
import { createStudy } from '../study/session'
import {
	captureTextSelection,
	readTextSelection,
	requestTagSelection,
	useTagging,
} from '../canvas/highlights/tagging'
import { caretRequest, useLookup } from '../canvas/lookup/store'
import { duplicateSelection, requestDeleteSelection } from '../canvas/annotations/editorOps'
import { KEYBOARD_ZOOM, fitAll, zoomTo100 } from '../canvas/focus/shortcuts'
import { getActiveEditor } from './editorStore'
import { updatePrefs } from '../lib/usePrefs'
import { useUiStore } from './uiStore'

export type CommandId = AppCommandId | 'selection.tag' | 'selection.duplicate' | 'selection.delete'

export interface AppCommand {
	id: CommandId
	title: string
	/** A title that tracks state ("Hide sidebar" / "Show sidebar"), as native menus do. */
	label?: () => string
	group: 'Study' | 'Selection' | 'Workspace' | 'View'
	/** Keycap label shown in the palette and tooltips. */
	shortcut?: string
	/** Bound globally by useGlobalShortcuts (⌘ + key). Canvas-scoped shortcuts omit this. */
	binding?: { key: string; shift?: boolean; ctrl?: boolean }
	/** Listed in the command palette. */
	palette?: boolean
	/**
	 * Whether the palette row is available, read when the palette renders (selection was captured as
	 * it opened). Rows that can't act are dimmed, as in native menus. The menu and the shortcut still
	 * run the command, which explains what to select.
	 */
	available?: () => boolean
	enabled?: () => boolean
	run: () => void
}

const ui = () => useUiStore.getState()
const withEditor =
	(run: (editor: NonNullable<ReturnType<typeof getActiveEditor>>) => void) => () => {
		const editor = getActiveEditor()
		if (editor) run(editor)
	}
const hasShapeSelection = () => (getActiveEditor()?.getSelectedShapeIds().length ?? 0) > 0
const hasWordSelection = () => {
	const editor = getActiveEditor()
	return (
		!!editor &&
		!!(useTagging.getState().captured ?? useLookup.getState().captured ?? readTextSelection(editor))
	)
}
const isEditingText = () => {
	const active = document.activeElement
	return (
		active instanceof HTMLInputElement ||
		active instanceof HTMLTextAreaElement ||
		(active instanceof HTMLElement && active.isContentEditable)
	)
}

export const commands: AppCommand[] = [
	{
		id: 'passage.add',
		title: 'Add verses…',
		group: 'Study',
		palette: true,
		run: () => ui().openInsert(''),
	},
	{
		id: 'study.new',
		title: 'New study',
		group: 'Study',
		shortcut: '⌘N',
		binding: { key: 'n' },
		palette: true,
		run: () => void createStudy(),
	},
	{
		id: 'word.lookup',
		title: 'Look up word',
		group: 'Selection',
		shortcut: '⌃⌘D',
		binding: { key: 'd', ctrl: true },
		palette: true,
		available: () => {
			const editor = getActiveEditor()
			return hasWordSelection() || (!!editor && !!caretRequest(editor))
		},
		run: withEditor(requestWordLookup),
	},
	{
		id: 'selection.tag',
		title: 'Tag selected words',
		group: 'Selection',
		shortcut: '⇧⌘H',
		palette: true,
		available: hasWordSelection,
		run: withEditor(requestTagSelection),
	},
	{
		id: 'selection.duplicate',
		title: 'Duplicate selection',
		group: 'Selection',
		shortcut: '⌘D',
		palette: true,
		available: hasShapeSelection,
		run: withEditor(duplicateSelection),
	},
	{
		id: 'selection.delete',
		title: 'Delete selection',
		group: 'Selection',
		shortcut: '⌫',
		palette: true,
		available: hasShapeSelection,
		run: withEditor(requestDeleteSelection),
	},
	{
		id: 'sidebar.toggle',
		title: 'Hide sidebar',
		label: () => (ui().sidebarOpen ? 'Hide sidebar' : 'Show sidebar'),
		group: 'Workspace',
		shortcut: '⌃⌘S',
		binding: { key: 's', ctrl: true },
		palette: true,
		run: () => ui().toggleSidebar(),
	},
	{
		id: 'palette.toggle',
		title: 'Command palette…',
		group: 'Workspace',
		shortcut: '⌘K',
		binding: { key: 'k' },
		run: () => {
			const editor = getActiveEditor()
			if (editor) {
				captureTextSelection(editor)
				captureLookupSelection(editor)
			}
			ui().togglePalette()
		},
	},
	{
		id: 'settings.open',
		title: 'Settings…',
		group: 'Workspace',
		shortcut: '⌘,',
		binding: { key: ',' },
		palette: true,
		run: () => ui().setSettingsOpen(true),
	},
	{
		id: 'edit.undo',
		title: 'Undo',
		group: 'Workspace',
		run: () => (isEditingText() ? document.execCommand('undo') : getActiveEditor()?.undo()),
	},
	{
		id: 'edit.redo',
		title: 'Redo',
		group: 'Workspace',
		run: () => (isEditingText() ? document.execCommand('redo') : getActiveEditor()?.redo()),
	},
	// macOS: ⌘0 is Actual Size (Preview, Safari, Pages). Canvas apps such as Sketch then use ⌘1 to
	// fit everything and ⌘2 to fit the selection, the same 0 / 1 / 2 order as tldraw's ⇧ keys.
	{
		id: 'view.actualSize',
		title: 'Actual size',
		group: 'View',
		shortcut: '⌘0',
		run: withEditor(zoomTo100),
	},
	{ id: 'view.fit', title: 'Zoom to fit', group: 'View', shortcut: '⌘1', run: withEditor(fitAll) },
	{
		id: 'view.zoomIn',
		title: 'Zoom in',
		group: 'View',
		shortcut: '⌘+',
		run: withEditor((e) => e.zoomIn(undefined, KEYBOARD_ZOOM)),
	},
	{
		id: 'view.zoomOut',
		title: 'Zoom out',
		group: 'View',
		shortcut: '⌘−',
		run: withEditor((e) => e.zoomOut(undefined, KEYBOARD_ZOOM)),
	},
	{
		id: 'appearance.system',
		title: 'Use system appearance',
		group: 'View',
		run: () => void updatePrefs({ appearance: 'system' }),
	},
	{
		id: 'appearance.light',
		title: 'Use light appearance',
		group: 'View',
		run: () => void updatePrefs({ appearance: 'light' }),
	},
	{
		id: 'appearance.dark',
		title: 'Use dark appearance',
		group: 'View',
		run: () => void updatePrefs({ appearance: 'dark' }),
	},
]

const byId = new Map(commands.map((command) => [command.id, command]))
export const shortcutFor = (id: CommandId) => byId.get(id)?.shortcut
/** The one name for a command, shared by tooltips and the palette (tooltips drop the ellipsis). */
export const labelFor = (command: AppCommand) => command.label?.() ?? command.title
export const titleFor = (id: CommandId) => {
	const command = byId.get(id)
	return command ? labelFor(command).replace(/…$/, '') : id
}

export function runCommand(id: CommandId) {
	const command = byId.get(id)
	if (command && (command.enabled?.() ?? true)) command.run()
}
