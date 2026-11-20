import { app, dialog, clipboard, Menu } from 'electron'
import type { BrowserWindow } from 'electron'
import { basename, dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { COMMAND_CHANNEL } from '@shared/ipc/commands'
import type { FlushReport, LibraryFolder, Preferences } from '@shared/ipc/contract'
import type { HostUi } from '@margin/services/ports'
import { onRendererFlushed } from '../ipc/boundary'

export function describeFolder(path: string, home = homedir()): LibraryFolder {
	const cloud = join(home, 'Library/Mobile Documents/com~apple~CloudDocs')
	const abbreviate = (value: string) => {
		if (value === cloud) return 'iCloud Drive'
		if (value.startsWith(cloud + '/')) return 'iCloud Drive' + value.slice(cloud.length)
		if (value === home) return '~'
		if (value === join(home, 'Documents')) return 'Documents'
		return value.startsWith(home + '/') ? '~' + value.slice(home.length) : value
	}
	if (path === home || path === cloud || path === '/')
		return { name: abbreviate(path), location: '' }
	return { name: basename(path), location: abbreviate(dirname(path)) }
}

export function createHostUi({
	getWindow,
	onAppearanceChange,
}: {
	getWindow: () => BrowserWindow | null
	onAppearanceChange: (preferences: Preferences) => void
}): HostUi {
	const pending = new Map<string, (result: FlushReport) => void>()
	onRendererFlushed({ getWindow, flushed: ({ token, ok }) => pending.get(token)?.(ok) })
	return {
		describeFolder,
		appearanceChanged: onAppearanceChange,
		emit: (event) => getWindow()?.webContents.send('margin:library:event', event),
		pickFolder: async (current) => {
			const result = await dialog.showOpenDialog({
				properties: ['openDirectory', 'createDirectory'],
				defaultPath: current,
			})
			return result.canceled ? null : (result.filePaths[0] ?? null)
		},
		confirmDiscard: async ({ message, detail, quit, loseChanges }) => {
			const window = getWindow()
			const options = {
				type: 'warning',
				message,
				detail,
				buttons: [
					'Keep open',
					loseChanges
						? quit
							? 'Quit and lose changes'
							: 'Close and lose changes'
						: quit
							? 'Quit anyway'
							: 'Close anyway',
				],
				defaultId: 0,
				cancelId: 0,
			} satisfies Electron.MessageBoxOptions
			const { response } = await (window && !window.isDestroyed()
				? dialog.showMessageBox(window, options)
				: dialog.showMessageBox(options))
			return response === 1 ? 'discard' : 'keep'
		},
		requestRendererFlush: async () => {
			const window = getWindow()
			if (!window) return true
			if (window.webContents.isDestroyed()) return false
			const token = crypto.randomUUID()
			return new Promise<FlushReport>((resolve) => {
				const timeout = setTimeout(() => {
					pending.delete(token)
					resolve(false)
				}, 15000)
				pending.set(token, (ok) => {
					clearTimeout(timeout)
					pending.delete(token)
					resolve(ok)
				})
				window.webContents.send('margin:library:request-flush', token)
			})
		},
		copyText: (text) => clipboard.writeText(text),
		showLookupMenu: async ({ word, multiple }) => {
			const window = getWindow()
			if (!window) return
			await new Promise<void>((resolve) => {
				Menu.buildFromTemplate([
					{
						label: multiple ? 'Look Up Selection' : `Look Up “${word}”`,
						click: () => window.webContents.send(COMMAND_CHANNEL, 'word.lookup'),
					},
					{ type: 'separator' },
					{ role: 'copy' },
				]).popup({ window, callback: resolve })
			})
		},
	}
}

export function installCloseEvents({
	getWindow,
	requestClose,
	close,
}: {
	getWindow: () => BrowserWindow | null
	requestClose: (args: { quit: boolean }) => Promise<boolean>
	close: () => Promise<void>
}) {
	let closing = false
	let requesting = false
	const onClose = (event: { preventDefault(): void }, quit: boolean) => {
		if (closing) return
		event.preventDefault()
		if (requesting) return
		requesting = true
		void requestClose({ quit })
			.then(async (allowed) => {
				if (!allowed) return
				closing = true
				if (quit) {
					await close()
					app.quit()
				} else {
					getWindow()?.once('closed', () => {
						closing = false
					})
					getWindow()?.close()
				}
			})
			.finally(() => {
				requesting = false
			})
	}
	app.on('browser-window-created', (_event, window) => {
		closing = false
		window.on('close', (event) => onClose(event, process.platform !== 'darwin'))
	})
	app.on('before-quit', (event) => onClose(event, true))
}
