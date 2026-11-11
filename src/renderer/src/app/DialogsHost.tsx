import { CommandPalette } from './CommandPalette'
import { SetupDialog } from './SetupDialog'
import { useStudySession } from '../study/session'
import { SettingsDialog } from './SettingsDialog'
import { DeleteConfirm } from './DeleteConfirm'
import { InsertPassageDialog } from '../insertion/InsertPassageDialog'
import { usePrefs } from '../lib/usePrefs'
import { useEditorStore } from './editorStore'
import { useUiStore } from './uiStore'
import type { TranslationId } from '@shared/bible/types'

export function DialogsHost() {
	const setup = useStudySession((state) => state.setup)
	const editor = useEditorStore((state) => state.editor)
	const paletteOpen = useUiStore((state) => state.paletteOpen)
	const settingsOpen = useUiStore((state) => state.settingsOpen)
	const insertQuery = useUiStore((state) => state.insertQuery)
	const { setPaletteOpen, setSettingsOpen, closeInsert } = useUiStore.getState()
	const { prefs, update: updatePrefs } = usePrefs()
	// The insertion dialog's translation choice is the persisted default (KJV until prefs load).
	const translation: TranslationId = prefs?.defaultTranslation ?? 'kjv'
	return (
		<>
			{setup === 'pending' && <SetupDialog />}
			<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
			<DeleteConfirm />
			<InsertPassageDialog
				open={insertQuery !== null}
				onOpenChange={(open) => !open && closeInsert()}
				initialQuery={insertQuery ?? ''}
				editor={editor}
				translation={translation}
				oldTestamentTranslation={prefs?.oldTestamentTranslation}
				onTranslationChange={(next) => void updatePrefs({ defaultTranslation: next })}
			/>
		</>
	)
}
