import * as Dialog from '@radix-ui/react-dialog'
import { useRef, useSyncExternalStore } from 'react'
import {
	noteFontChoice,
	noteFontPreferences,
	setPreferences,
	usePreferences,
} from '../lib/preferences'
import type { NoteFontChoice } from '../lib/preferences'
import { usePrefs } from '../lib/usePrefs'
import { translationNames, translationOrder, wholeBibleTranslations } from '../insertion/labels'
import { translationIdSchema } from '@shared/bible/types'
import { appearanceSchema } from '@shared/ipc/contract'

const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)')
const subscribeTransparency = (listener: () => void) => {
	reducedTransparency.addEventListener('change', listener)
	return () => reducedTransparency.removeEventListener('change', listener)
}

export function SettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const noteFont = usePreferences(noteFontChoice)
	const { prefs, update } = usePrefs()
	const isMac = navigator.userAgent.includes('Mac')
	const panel = useRef<HTMLDivElement>(null)
	// With Reduce Transparency on, macOS shows solid chrome whatever this setting says.
	const transparencyReduced = useSyncExternalStore(
		subscribeTransparency,
		() => reducedTransparency.matches,
	)
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay" />
				<Dialog.Content
					ref={panel}
					tabIndex={-1}
					className="dialog-panel settings-panel"
					aria-describedby="settings-description"
					// Focus the sheet, not the first pop-up, so nothing wears a ring the user didn't ask for.
					onOpenAutoFocus={(event) => {
						event.preventDefault()
						panel.current?.focus()
					}}
				>
					<Dialog.Title>Settings</Dialog.Title>
					<Dialog.Description id="settings-description" className="sr-only">
						Choose a translation, note font and appearance.
					</Dialog.Description>
					<label className="select-row">
						<span>Default translation</span>
						<select
							className="field"
							value={prefs?.defaultTranslation ?? 'kjv'}
							disabled={!prefs}
							onChange={(e) =>
								void update({ defaultTranslation: translationIdSchema.parse(e.target.value) })
							}
						>
							{wholeBibleTranslations.map((id) => (
								<option key={id} value={id}>
									{translationNames[id].short}
								</option>
							))}
						</select>
					</label>
					<label className="select-row">
						<span>Old Testament translation</span>
						<select
							className="field"
							value={prefs?.oldTestamentTranslation ?? 'kjv'}
							disabled={!prefs}
							onChange={(e) =>
								void update({ oldTestamentTranslation: translationIdSchema.parse(e.target.value) })
							}
						>
							{translationOrder.map((id) => (
								<option key={id} value={id}>
									{translationNames[id].short}
								</option>
							))}
						</select>
					</label>
					<label className="select-row">
						<span>Appearance</span>
						<select
							className="field"
							value={prefs?.appearance ?? 'system'}
							disabled={!prefs}
							onChange={(e) => void update({ appearance: appearanceSchema.parse(e.target.value) })}
						>
							<option value="system">System</option>
							<option value="light">Light</option>
							<option value="dark">Dark</option>
						</select>
					</label>
					<label className="select-row">
						<span>Note font</span>
						<select
							className="field"
							value={noteFont}
							onChange={(e) =>
								void setPreferences(noteFontPreferences(e.target.value as NoteFontChoice))
							}
						>
							<option value="handwritten">Handwritten</option>
							<option value="system-new">System for new notes</option>
							<option value="system-all">System for all notes</option>
						</select>
					</label>
					{isMac && (
						<label className="check-row">
							<input
								type="checkbox"
								checked={prefs?.liquidGlass !== false && !transparencyReduced}
								disabled={!prefs || transparencyReduced}
								onChange={(e) => void update({ liquidGlass: e.target.checked })}
							/>
							<span>
								Translucent title bar and sidebar
								{transparencyReduced && (
									<small>Off while Reduce Transparency is on in System Settings.</small>
								)}
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
