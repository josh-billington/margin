import * as Dialog from '@radix-ui/react-dialog'
import { useRef, useState } from 'react'
import { Folder } from 'lucide-react'
import { translationIdSchema } from '@shared/bible/types'
import { translationNames } from '../insertion/labels'
import { iconLg } from '../lib/icons'
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
									<Folder {...iconLg} aria-hidden="true" />
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
						Studies are plain files. A folder in iCloud Drive keeps them on every Mac.
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
