import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { X } from 'lucide-react'
import { translationIdSchema } from '@shared/bible/types'
import { translationNames } from '../insertion/labels'
import { usePrefs } from '../lib/usePrefs'
import { chooseLibrary, completeSetup, useStudySession } from '../study/session'
import { report } from '../study/state'

export function SetupDialog() {
	const setup = useStudySession((state) => state.setup)
	const path = useStudySession((state) => state.libraryPath)
	const { prefs, update: updatePrefs } = usePrefs()
	const [busy, setBusy] = useState(false)
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
		<Dialog.Root open={setup === 'pending'} onOpenChange={(open) => !open && finish()}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay" />
				<Dialog.Content className="dialog-panel setup-panel" aria-describedby="setup-description">
					<Dialog.Title>Set up Margin</Dialog.Title>
					<button
						className="icon-button setup-close"
						aria-label="Close setup"
						onClick={finish}
						disabled={busy}
					>
						<X size={16} />
					</button>
					<div className="setup-folder">
						<div className="setup-folder-row">
							<div>
								<span>Study folder</span>
								<div className="setup-path" title={path}>
									{path}
								</div>
							</div>
							<button className="button" disabled={busy} onClick={() => void run(chooseLibrary)}>
								Choose…
							</button>
						</div>
						<Dialog.Description id="setup-description">
							Studies are plain files. A folder in iCloud Drive keeps them on every Mac.
						</Dialog.Description>
					</div>
					<label className="select-row">
						<span>Default translation</span>
						<select
							value={prefs?.defaultTranslation ?? 'kjv'}
							disabled={!prefs || busy}
							onChange={(event) => {
								const defaultTranslation = translationIdSchema.parse(event.target.value)
								void run(() => updatePrefs({ defaultTranslation }))
							}}
						>
							{(['bsb', 'web', 'asv', 'kjv'] as const).map((id) => (
								<option key={id} value={id}>
									{translationNames[id].short}
								</option>
							))}
						</select>
					</label>
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
