import './library.css'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Lock } from 'lucide-react'
import type { LockNotice } from '@shared/ipc/contract'
import { takeOverLibrary } from '../study/session'
import { iconMd } from '../lib/icons'

function formatSince(since: string | null) {
	if (!since) return 'an unknown time'
	const date = new Date(since)
	return Number.isNaN(date.getTime()) ? 'an unknown time' : date.toLocaleString()
}

/** Read-only notice for a library locked by another computer. Takeover replaces that lock. */
export function LibraryLockNotice({ lock }: { lock: LockNotice }) {
	return (
		<div className="library-lock-notice" role="status">
			<Lock {...iconMd} aria-hidden="true" />
			<p>
				Margin cannot save changes here. {lock.host} has this library open. It opened the library at{' '}
				{formatSince(lock.since)}.
			</p>
			<AlertDialog.Root>
				<AlertDialog.Trigger asChild>
					<button className="text-button">Take over</button>
				</AlertDialog.Trigger>
				<AlertDialog.Portal>
					<AlertDialog.Overlay className="dialog-overlay" />
					<AlertDialog.Content className="dialog-panel">
						<AlertDialog.Title>Take over this library?</AlertDialog.Title>
						<AlertDialog.Description>
							Close Margin on {lock.host} before you take over. Otherwise, both computers could
							overwrite your changes.
						</AlertDialog.Description>
						<div className="dialog-actions">
							<AlertDialog.Cancel asChild>
								<button className="button">Cancel</button>
							</AlertDialog.Cancel>
							<AlertDialog.Action asChild>
								<button className="button button-primary" onClick={() => void takeOverLibrary()}>
									Take over
								</button>
							</AlertDialog.Action>
						</div>
					</AlertDialog.Content>
				</AlertDialog.Portal>
			</AlertDialog.Root>
		</div>
	)
}
