import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { hostname, homedir } from 'node:os'
import { z } from 'zod'
import { AppDataStore } from '../appData/store'
import { Library } from '../library/library'
import { migrateStudy } from '../../shared/study/migrations'
import { ipcContract } from '../../shared/ipc/contract'
import type { LibraryFolder, Preferences } from '../../shared/ipc/contract'
import { logEvent, logFailure } from '../logger'
import { userMessage } from '../../shared/errors'

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

const NO_PERMISSION =
	"Margin doesn't have permission to save in the library folder. Check the folder's permissions in Finder, or choose another library folder."
const FILE_ERRORS: Record<string, string> = {
	EACCES: NO_PERMISSION,
	EPERM: NO_PERMISSION,
	EROFS:
		"Margin can't save to the disk that holds the library folder. Choose another library folder.",
	ENOSPC: "Margin couldn't save because the disk is full. Free up some space and try again.",
	ENOENT:
		"Margin can't find the library folder. If you moved it or it's on a disconnected drive, put it back and try again.",
}
const SAVE_FALLBACK =
	"Margin couldn't save your changes. Try again or save a copy before closing or switching studies."
/** File-system failures in words a reader can act on; other errors only show if written for the user. */
export function errorMessage(error: unknown, fallback = SAVE_FALLBACK): string {
	const code = error instanceof Error && 'code' in error ? String(error.code) : undefined
	if (code && FILE_ERRORS[code]) return FILE_ERRORS[code]
	return userMessage(error, fallback)
}

export async function registerPersistence(
	getWindow: () => BrowserWindow | null,
	onAppearanceChange: (preferences: Preferences) => void = () => {},
) {
	const data = new AppDataStore(app.getPath('userData'))
	let startupError: string | null = null
	let prefsFailed = false
	try {
		await data.open()
	} catch (error) {
		logFailure('prefs-open-failed', error)
		startupError = errorMessage(
			error,
			"Margin couldn't load your settings. Try again or choose another library folder.",
		)
		prefsFailed = true
	}
	let library = new Library(
		process.env.MARGIN_LIBRARY_DIR ??
			data.libraryPath ??
			process.env.MARGIN_DEFAULT_LIBRARY_DIR ??
			join(app.getPath('documents'), 'Margin'),
		data.path,
	)
	let initialized = false
	if (data.setup === 'done' && !prefsFailed) {
		try {
			await library.initialize()
			initialized = true
		} catch (error) {
			logFailure('library-initialize-failed', error)
			startupError = errorMessage(
				error,
				"Margin couldn't open your library. Try again or choose another library folder.",
			)
		}
	}
	const notify = () => {
		library.onEvent = (event) => getWindow()?.webContents.send('margin:library:event', event)
	}
	notify()
	// Only a lock from another computer is surfaced; a live same-host owner stays a plain read-only open.
	const describe = () => ({
		path: library.path,
		folder: describeFolder(library.path),
		setup: initialized ? data.setup : 'pending',
		error: startupError,
		readOnly: library.readOnly,
		lock:
			library.lockOwner && library.lockOwner.hostname !== hostname()
				? { host: library.lockOwner.hostname, since: library.lockOwner.acquiredAt ?? null }
				: null,
	})
	function handle<I extends z.ZodType, O extends z.ZodType>(
		operation: { channel: string; request: I; response: O },
		action: (request: z.output<I>) => Promise<unknown>,
		failureMessage = "Margin couldn't update the library. Check that you can open the library folder and try again.",
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
					error: {
						code: 'FORBIDDEN',
						message: 'Margin blocked a request from another window. Try again in the main window.',
					},
				})
			const parsed = operation.request.safeParse(payload)
			if (!parsed.success)
				return operation.response.parse({
					ok: false,
					error: {
						code: 'INVALID_REQUEST',
						message: "Margin couldn't read this request. Try again.",
					},
				})
			try {
				return operation.response.parse({ ok: true, data: await action(parsed.data) })
			} catch (error) {
				logFailure('persistence-operation-failed', error)
				return operation.response.parse({
					ok: false,
					error: {
						code: 'SAVE_FAILED',
						message: errorMessage(error, failureMessage),
					},
				})
			}
		})
	}
	handle(ipcContract.library.getLibrary, async () => describe())
	handle(ipcContract.library.completeSetup, async () => {
		if (!initialized) {
			if (prefsFailed) {
				await data.open()
				prefsFailed = false
			}
			await library.initialize()
			try {
				await data.completeSetup()
			} catch (error) {
				await library.close()
				throw error
			}
			initialized = true
			startupError = null
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
		if (initialized) await next.initialize()
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
		startupError = null
		notify()
		return describe()
	})
	handle(ipcContract.library.listStudies, () =>
		!initialized ? Promise.resolve([]) : library.list(),
	)
	handle(
		ipcContract.library.openStudy,
		({ studyId }) => library.open(studyId),
		"Margin couldn't open this study. Restore a backup or open another study.",
	)
	handle(ipcContract.library.createStudy, ({ title, document }) => library.create(title, document))
	handle(
		ipcContract.library.saveStudy,
		({ study, sequence, base }) => library.save(migrateStudy(study), sequence, base),
		"Margin couldn't save your changes. Check that you can save files in the library folder, then try again or save a copy.",
	)
	handle(ipcContract.library.closeStudy, async ({ studyId }) => {
		await library.closeStudy(studyId)
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
	handle(
		ipcContract.prefs.get,
		async () => data.preferences,
		"Margin couldn't load your settings. Restart Margin and try again.",
	)
	handle(
		ipcContract.prefs.set,
		async (patch) => {
			await data.update((settings) => {
				Object.assign(settings.preferences, patch)
			})
			if ('appearance' in patch) onAppearanceChange(data.preferences)
			return data.preferences
		},
		"Margin couldn't save your settings. Try again.",
	)
	handle(
		ipcContract.camera.get,
		async ({ studyId }) => data.camera(studyId),
		"Margin couldn't restore the canvas view. Close the study and open it again.",
	)
	handle(
		ipcContract.camera.set,
		async ({ studyId, camera }) => {
			await data.update((settings) => {
				settings.cameras[studyId] = camera
			})
			return null
		},
		"Margin couldn't save the canvas view. Try again.",
	)

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
		const finish = async () => {
			closing = true
			if (quit) {
				await library.close().catch((error) => logFailure('library-close-failed', error))
				app.quit()
			} else {
				getWindow()?.once('closed', () => {
					closing = false
				})
				getWindow()?.close()
			}
		}
		void requestFlush()
			.then(async (ok) => {
				if (!ok) throw new Error('The latest changes could not be saved.')
				await library.flush()
				await finish()
			})
			.catch(async (error) => {
				logFailure('close-flush-failed', error)
				// Never trap the user in the app: offer to leave, keeping the changes as a recovery copy.
				const window = getWindow()
				// The heading already says the save failed; only a specific cause adds anything.
				const cause = errorMessage(error)
				const options = {
					type: 'warning' as const,
					message: "Margin couldn't save your latest changes",
					detail: [
						cause === SAVE_FALLBACK ? null : cause,
						`Keep Margin open to try again or save a copy. If you ${quit ? 'quit' : 'close'} now, Margin keeps your changes in a recovery copy and offers it the next time you open the study.`,
					]
						.filter(Boolean)
						.join('\n\n'),
					buttons: ['Keep open', quit ? 'Quit anyway' : 'Close anyway'],
					defaultId: 0,
					cancelId: 0,
				}
				const { response } = await (window && !window.isDestroyed()
					? dialog.showMessageBox(window, options)
					: dialog.showMessageBox(options))
				if (response !== 1) return
				const { preserved, failed } = await library.preserveUnsaved()
				logEvent('quit-with-unsaved', { preserved: preserved.length, failed: failed.length })
				if (failed.length) {
					const warning = {
						type: 'warning' as const,
						message: "Margin couldn't keep a recovery copy of these studies",
						detail: `${failed.map(({ title }) => title).join('\n')}\n\nKeep Margin open to try again or save a copy. If you ${quit ? 'quit' : 'close'} now, you will lose the unsaved changes in these studies.`,
						buttons: ['Keep open', quit ? 'Quit and lose changes' : 'Close and lose changes'],
						defaultId: 0,
						cancelId: 0,
					}
					const choice = await (window && !window.isDestroyed()
						? dialog.showMessageBox(window, warning)
						: dialog.showMessageBox(warning))
					if (choice.response !== 1) return
					for (const { id } of failed) library.abandon(id)
				}
				for (const id of preserved) library.abandon(id)
				await finish()
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
