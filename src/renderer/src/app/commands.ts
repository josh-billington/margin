import type { AppCommandId } from '@shared/ipc/commands'
import { captureLookupSelection, requestWordLookup } from '../canvas/lookup/store'
import { createStudy } from '../study/session'
import { captureTextSelection, requestTagSelection } from '../canvas/highlights/tagging'
import { duplicateSelection, requestDeleteSelection } from '../canvas/annotations/editorOps'
import { fitAll, zoomTo100 } from '../canvas/focus/shortcuts'
import { getActiveEditor } from './editorStore'
import { updatePrefs } from '../lib/usePrefs'
import { useUiStore } from './uiStore'

export type CommandId = AppCommandId | 'selection.tag' | 'selection.duplicate' | 'selection.delete'

export interface AppCommand {
	id: CommandId
	title: string
	group: 'Study' | 'Selection' | 'Workspace' | 'View'
	/** Keycap label shown in the palette and tooltips. */
	shortcut?: string
	/** Bound globally by useGlobalShortcuts (⌘ + key). Canvas-scoped shortcuts omit this. */
	binding?: { key: string; shift?: boolean; ctrl?: boolean }
	/** Listed in the command palette. */
	palette?: boolean
	enabled?: () => boolean
	run: () => void
}

const ui = () => useUiStore.getState()
const withEditor =
	(run: (editor: NonNullable<ReturnType<typeof getActiveEditor>>) => void) => () => {
		const editor = getActiveEditor()
		if (editor) run(editor)
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
		run: withEditor(requestWordLookup),
	},
	{
		id: 'selection.tag',
		title: 'Tag selected words',
		group: 'Selection',
		shortcut: '⇧⌘H',
		palette: true,
		run: withEditor(requestTagSelection),
	},
	{
		id: 'selection.duplicate',
		title: 'Duplicate selection',
		group: 'Selection',
		shortcut: '⌘D',
		palette: true,
		run: withEditor(duplicateSelection),
	},
	{
		id: 'selection.delete',
		title: 'Delete selection',
		group: 'Selection',
		palette: true,
		run: withEditor(requestDeleteSelection),
	},
	{
		id: 'sidebar.toggle',
		title: 'Toggle sidebar',
		group: 'Workspace',
		shortcut: '⌘\\',
		binding: { key: '\\' },
		palette: true,
		run: () => ui().toggleSidebar(),
	},
	{
		id: 'palette.toggle',
		title: 'Command palette',
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
	{ id: 'view.fit', title: 'Zoom to fit', group: 'View', shortcut: '⌘0', run: withEditor(fitAll) },
	{
		id: 'view.actualSize',
		title: 'Actual size',
		group: 'View',
		shortcut: '⌘1',
		run: withEditor(zoomTo100),
	},
	{ id: 'view.zoomIn', title: 'Zoom in', group: 'View', run: withEditor((e) => e.zoomIn()) },
	{ id: 'view.zoomOut', title: 'Zoom out', group: 'View', run: withEditor((e) => e.zoomOut()) },
	{
		id: 'appearance.system',
		title: 'Appearance: system',
		group: 'View',
		run: () => void updatePrefs({ appearance: 'system' }),
	},
	{
		id: 'appearance.light',
		title: 'Appearance: light',
		group: 'View',
		run: () => void updatePrefs({ appearance: 'light' }),
	},
	{
		id: 'appearance.dark',
		title: 'Appearance: dark',
		group: 'View',
		run: () => void updatePrefs({ appearance: 'dark' }),
	},
]

const byId = new Map(commands.map((command) => [command.id, command]))
export const shortcutFor = (id: CommandId) => byId.get(id)?.shortcut

export function runCommand(id: CommandId) {
	const command = byId.get(id)
	if (command && (command.enabled?.() ?? true)) command.run()
}
