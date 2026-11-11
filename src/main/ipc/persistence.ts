import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { hostname, homedir } from 'node:os'
import { z } from 'zod'
import { AppDataStore } from '../appData/store'
import { Library } from '../library/library'
import { migrateStudy } from '../../shared/study/migrations'
import { ipcContract } from '../../shared/ipc/contract'
import type { Preferences } from '../../shared/ipc/contract'

export async function registerPersistence(
	getWindow: () => BrowserWindow | null,
	onAppearanceChange: (preferences: Preferences) => void = () => {},
) {
	const data = await new AppDataStore(app.getPath('userData')).open()
	let library = new Library(
		process.env.MARGIN_LIBRARY_DIR ??
			data.libraryPath ??
			process.env.MARGIN_DEFAULT_LIBRARY_DIR ??
			join(app.getPath('documents'), 'Margin'),
		data.path,
	)
	if (data.setup === 'done') await library.initialize()
	const notify = () => {
		library.onEvent = (event) => getWindow()?.webContents.send('margin:library:event', event)
	}
	notify()
	// Only a lock from another computer is surfaced; a live same-host owner stays a plain read-only open.
	const describe = () => ({
		path: library.path,
		displayPath:
			library.path === homedir()
				? '~'
				: library.path.startsWith(homedir() + '/')
					? '~' + library.path.slice(homedir().length)
					: library.path,
		setup: data.setup,
		readOnly: library.readOnly,
		lock:
			library.lockOwner && library.lockOwner.hostname !== hostname()
				? { host: library.lockOwner.hostname, since: library.lockOwner.acquiredAt ?? null }
				: null,
	})
	function handle<I extends z.ZodType, O extends z.ZodType>(
		operation: { channel: string; request: I; response: O },
		action: (request: z.output<I>) => Promise<unknown>,
	) {
		ipcMain.removeHandler(operation.channel)
		ipcMain.handle(operation.channel, async (event, payload: unknown) => {
			const window = getWindow()
			if (
				!window ||
				event.sender !== window.webContents ||
				event.senderFrame !== window.webContents.mainFrame
			)
				return operation.response.parse({
					ok: false,
					error: { code: 'FORBIDDEN', message: 'Untrusted IPC sender.' },
				})
			const parsed = operation.request.safeParse(payload)
			if (!parsed.success)
				return operation.response.parse({
					ok: false,
					error: { code: 'INVALID_REQUEST', message: 'Invalid request.' },
				})
			try {
				return operation.response.parse({ ok: true, data: await action(parsed.data) })
			} catch (error) {
				return operation.response.parse({
					ok: false,
					error: {
						code: 'SAVE_FAILED',
						message: error instanceof Error ? error.message : String(error),
					},
				})
			}
		})
	}
	handle(ipcContract.library.getLibrary, async () => describe())
	handle(ipcContract.library.completeSetup, async () => {
		if (data.setup === 'pending') {
			await library.initialize()
			try {
				await data.completeSetup()
			} catch (error) {
				await library.close()
				throw error
			}
		}
		return describe()
	})
	handle(ipcContract.library.takeOver, async () => {
		await library.takeOver()
		return describe()
	})
	handle(ipcContract.library.chooseLibraryFolder, async () => {
		const result = await dialog.showOpenDialog({
			properties: ['openDirectory', 'createDirectory'],
			defaultPath: library.path,
		})
		const path = result.filePaths[0]
		if (result.canceled || !path || path === library.path) return null
		await library.flush()
		const next = new Library(path, data.path)
		if (data.setup === 'done') await next.initialize()
		try {
			await data.update((settings) => {
				settings.libraryPath = path
			})
		} catch (error) {
			await next.close()
			throw error
		}
		await library.close()
		library = next
		notify()
		return describe()
	})
	handle(ipcContract.library.listStudies, () =>
		data.setup === 'pending' ? Promise.resolve([]) : library.list(),
	)
	handle(ipcContract.library.openStudy, ({ studyId }) => library.open(studyId))
	handle(ipcContract.library.createStudy, ({ title, document }) => library.create(title, document))
	handle(ipcContract.library.saveStudy, ({ study, sequence, base }) =>
		library.save(migrateStudy(study), sequence, base),
	)
	handle(ipcContract.library.closeStudy, async ({ studyId }) => {
		await library.flush()
		library.abandon(studyId)
		return null
	})
	handle(ipcContract.library.stageStudy, async ({ study, sequence }) => {
		library.stage(migrateStudy(study), sequence)
		return null
	})
	handle(ipcContract.library.deleteStudy, async ({ studyId }) => {
		await library.delete(studyId)
		return null
	})
	handle(ipcContract.library.flush, async () => {
		await library.flush()
		return null
	})
	handle(ipcContract.prefs.get, async () => data.preferences)
	handle(ipcContract.prefs.set, async (patch) => {
		await data.update((settings) => {
			Object.assign(settings.preferences, patch)
		})
		if ('appearance' in patch) onAppearanceChange(data.preferences)
		return data.preferences
	})
	handle(ipcContract.camera.get, async ({ studyId }) => data.camera(studyId))
	handle(ipcContract.camera.set, async ({ studyId, camera }) => {
		await data.update((settings) => {
			settings.cameras[studyId] = camera
		})
		return null
	})

	let closing = false
	let requesting = false
	const pending = new Map<string, (ok: boolean) => void>()
	ipcMain.on('margin:library:flushed', (event, payload: unknown) => {
		const window = getWindow()
		const parsed = z.object({ token: z.string(), ok: z.boolean() }).safeParse(payload)
		if (
			window &&
			event.sender === window.webContents &&
			event.senderFrame === window.webContents.mainFrame &&
			parsed.success
		)
			pending.get(parsed.data.token)?.(parsed.data.ok)
	})
	async function requestFlush() {
		const window = getWindow()
		if (!window || window.webContents.isDestroyed()) return true
		const token = randomUUID()
		return new Promise<boolean>((resolve) => {
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
	}
	const close = (event: { preventDefault: () => void }, quit: boolean) => {
		if (closing) return
		event.preventDefault()
		if (requesting) return
		requesting = true
		void requestFlush()
			.then(async (ok) => {
				if (ok) {
					await library.flush()
					closing = true
					if (quit) {
						await library.close()
						app.quit()
					} else {
						getWindow()?.once('closed', () => {
							closing = false
						})
						getWindow()?.close()
					}
				}
			})
			.catch((error) => {
				getWindow()?.webContents.send('margin:library:event', {
					kind: 'error',
					studyId: '',
					message: String(error),
				})
			})
			.finally(() => {
				requesting = false
			})
	}
	app.on('browser-window-created', (_event, window) => {
		closing = false
		window.on('close', (event) => close(event, process.platform !== 'darwin'))
	})
	app.on('before-quit', (event) => close(event, true))
	return data
}
