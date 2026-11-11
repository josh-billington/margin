import * as Dialog from '@radix-ui/react-dialog'
import { setPreferences, usePreferences } from '../lib/preferences'
import { usePrefs } from '../lib/usePrefs'
import { translationNames } from '../insertion/labels'
import { translationIdSchema } from '@shared/bible/types'
import { appearanceSchema } from '@shared/ipc/contract'

export function SettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const { defaultNoteFont, displayNotesInPlainFont } = usePreferences()
	const { prefs, update } = usePrefs()
	const isMac = navigator.userAgent.includes('Mac')
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay" />
				<Dialog.Content className="dialog-panel" aria-describedby="settings-description">
					<Dialog.Title>Settings</Dialog.Title>
					<Dialog.Description id="settings-description" className="sr-only">
						Old Testament translation, note font and window appearance preferences.
					</Dialog.Description>
					<label className="select-row">
						<span>
							Default Old Testament translation
						</span>
						<select
							value={prefs?.oldTestamentTranslation ?? 'kjv'}
							disabled={!prefs}
							onChange={(e) =>
								void update({ oldTestamentTranslation: translationIdSchema.parse(e.target.value) })
							}
						>
							{translationIdSchema.options.map((id) => (
								<option key={id} value={id}>
									{translationNames[id].short}
								</option>
							))}
						</select>
					</label>
					<label className="select-row">
						<span>Appearance</span>
						<select
							value={prefs?.appearance ?? 'system'}
							disabled={!prefs}
							onChange={(e) => void update({ appearance: appearanceSchema.parse(e.target.value) })}
						>
							<option value="system">System</option>
							<option value="light">Light</option>
							<option value="dark">Dark</option>
						</select>
					</label>
					<label className="check-row">
						<input
							type="checkbox"
							checked={defaultNoteFont === 'plain'}
							onChange={(e) =>
								void setPreferences({
									defaultNoteFont: e.target.checked ? 'plain' : 'handwritten',
								})
							}
						/>
						<span>Use the system font for new notes</span>
					</label>
					<label className="check-row">
						<input
							type="checkbox"
							checked={displayNotesInPlainFont}
							onChange={(e) => void setPreferences({ displayNotesInPlainFont: e.target.checked })}
						/>
						<span>
							Display notes in system font
						</span>
					</label>
					{isMac && (
						<label className="check-row">
							<input
								type="checkbox"
								checked={prefs?.liquidGlass !== false}
								disabled={!prefs}
								onChange={(e) => void update({ liquidGlass: e.target.checked })}
							/>
							<span>
								Use liquid glass for top and sidebar
							</span>
						</label>
					)}
					<div className="dialog-actions">
						<Dialog.Close asChild>
							<button className="button button-primary">Done</button>
						</Dialog.Close>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
