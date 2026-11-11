import * as Dialog from '@radix-ui/react-dialog'
import { useRef, useState } from 'react'
import { translationIdSchema } from '@shared/bible/types'
import { translationNames } from '../insertion/labels'
import { usePrefs } from '../lib/usePrefs'
import { chooseLibrary, completeSetup, useStudySession } from '../study/session'
import { report } from '../study/state'

export function SetupDialog() {
	const path = useStudySession((state) => state.libraryPath)
	const folder = useStudySession((state) => state.libraryFolder)
	const { prefs, update: updatePrefs } = usePrefs()
	const [busy, setBusy] = useState(false)
	const panel = useRef<HTMLDivElement>(null)
	async function run(action: () => Promise<unknown>) {
		setBusy(true)
		try {
			await action()
		} catch (error) {
			report(error)
		} finally {
			setBusy(false)
		}
	}
	const finish = () => {
		if (!busy) void run(completeSetup)
	}
	return (
		<Dialog.Root open onOpenChange={(open) => !open && finish()}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay" />
				<Dialog.Content
					ref={panel}
					tabIndex={-1}
					className="dialog-panel setup-panel"
					aria-describedby="setup-description"
					onOpenAutoFocus={(event) => {
						event.preventDefault()
						panel.current?.focus()
					}}
					onKeyDown={(event) => {
						if (
							event.key === 'Enter' &&
							!event.nativeEvent.isComposing &&
							!(event.target instanceof HTMLSelectElement)
						) {
							event.preventDefault()
							finish()
						}
					}}
				>
					<Dialog.Title>Set up Margin</Dialog.Title>
					<div className="setup-group">
						<div className="setup-row">
							<span id="setup-folder-label">Study folder</span>
							<div className="setup-folder-control">
								<div className="setup-folder" title={path} aria-labelledby="setup-folder-label">
									<FolderGlyph />
									<div className="setup-folder-text">
										<span className="setup-folder-name">{folder?.name}</span>
										{folder?.location && (
											<span className="setup-location">
												<bdi dir="ltr">{folder.location}</bdi>
											</span>
										)}
									</div>
								</div>
								<button className="button" disabled={busy} onClick={() => void run(chooseLibrary)}>
									Choose…
								</button>
							</div>
						</div>
						<div className="setup-row">
							<label htmlFor="setup-translation">Default translation</label>
							<select
								id="setup-translation"
								className="field"
								value={prefs?.defaultTranslation ?? 'kjv'}
								disabled={!prefs || busy}
								onChange={(event) => {
									const defaultTranslation = translationIdSchema.parse(event.target.value)
									void run(() => updatePrefs({ defaultTranslation }))
								}}
							>
								{(['bsb', 'web', 'asv', 'kjv'] as const).map((id) => (
									<option key={id} value={id}>
										{translationNames[id].long}
									</option>
								))}
							</select>
						</div>
					</div>
					<Dialog.Description id="setup-description" className="setup-footnote">
						Margin saves each study as a file in this folder. To use your studies on more than one
						Mac, choose a folder in iCloud Drive.
					</Dialog.Description>
					<div className="dialog-actions">
						<button className="button button-primary" disabled={busy} onClick={finish}>
							Start studying
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}

function FolderGlyph() {
	return (
		<svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
			<path fill="var(--folder-back)" d="M1 3a2 2 0 0 1 2-2h6l2 2h10a2 2 0 0 1 2 2v6H1Z" />
			<rect fill="var(--folder-front)" x="1" y="5" width="22" height="14" rx="2" />
		</svg>
	)
}
