import type { z } from 'zod'
import type { IpcError } from '@margin/contract/ipc/contract'
import { ipcContract } from '@margin/contract/ipc/contract'
import { userMessage } from '@margin/contract/errors'
import { FileError } from './ports'
import { validated } from './request'
import { validateStudyDocument } from '@margin/contract/study/migrations'
import type { HostIdentity, HostUi, Diagnostics } from './ports'
import type { AppDataStore } from './appData/store'
import type { Library } from './library/library'

const NO_PERMISSION =
	'Margin doesn’t have permission to save in the library folder. Check the folder’s permissions in Finder, or choose another library folder.'
const FILE_ERRORS: Record<string, string> = {
	denied: NO_PERMISSION,
	readOnly:
		'Margin can’t save to the disk that holds the library folder. Choose another library folder.',
	full: 'Margin couldn’t save because the disk is full. Free up some space and try again.',
	missing:
		'Margin can’t find the library folder. If you moved it or it’s on a disconnected drive, put it back and try again.',
}
const SAVE_FALLBACK =
	'Margin couldn’t save your changes. Try again or save a copy before closing or switching studies.'
/** File-system failures in words a reader can act on; other errors only show if written for the user. */
export function errorMessage(error: unknown, fallback = SAVE_FALLBACK): string {
	const code = error instanceof FileError ? error.kind : undefined
	if (code && FILE_ERRORS[code]) return FILE_ERRORS[code]
	return userMessage(error, fallback)
}

export async function createPersistence({
	data,
	openLibrary,
	pathOverride,
	defaultPath,
	host,
	ui,
	diagnostics,
}: {
	data: AppDataStore
	openLibrary: (path: string) => Library
	pathOverride?: string
	defaultPath: string
	host: HostIdentity
	ui: HostUi
	diagnostics: Diagnostics
}) {
	let startupError: string | null = null
	let prefsFailed = false
	try {
		await data.open()
	} catch (error) {
		diagnostics.failure('prefs-open-failed', error)
		startupError = errorMessage(
			error,
			'Margin couldn’t load your settings. Try again or choose another library folder.',
		)
		prefsFailed = true
	}
	let library = openLibrary(pathOverride ?? data.libraryPath ?? defaultPath)
	let initialized = false
	if (data.setup === 'done' && !prefsFailed) {
		try {
			await library.initialize()
			initialized = true
		} catch (error) {
			diagnostics.failure('library-initialize-failed', error)
			startupError = errorMessage(
				error,
				'Margin couldn’t open your library. Try again or choose another library folder.',
			)
		}
	}
	const notify = () => {
		library.onEvent = (event) => ui.emit(event)
	}
	notify()
	// Only a lock from another computer is surfaced; a live same-host owner stays a plain read-only open.
	const describe = () => ({
		path: library.path,
		folder: ui.describeFolder(library.path),
		setup: initialized ? data.setup : 'pending',
		error: startupError,
		readOnly: library.readOnly,
		lock:
			library.lockOwner && library.lockOwner.hostname !== host.current().hostname
				? { host: library.lockOwner.hostname, since: library.lockOwner.acquiredAt ?? null }
				: null,
	})
	function handle<I extends z.ZodType, O extends z.ZodType>(
		operation: { request: I; response: O },
		action: (
			request: z.output<I>,
		) => Promise<Extract<z.output<O>, { ok: true }> extends { data: infer D } ? D : never>,
		failureMessage = 'Margin couldn’t update the library. Check that you can open the library folder and try again.',
	) {
		const success = <T>(data: T): { ok: true; data: T } => ({ ok: true, data })
		const failure = (error: IpcError): { ok: false; error: IpcError } => ({ ok: false, error })
		return validated(operation.request, async (request) => {
			try {
				return success(await action(request))
			} catch (error) {
				diagnostics.failure('persistence-operation-failed', error)
				return failure({ code: 'SAVE_FAILED', message: errorMessage(error, failureMessage) })
			}
		})
	}
	const handlers = {
		[ipcContract.library.getLibrary.channel]: handle(ipcContract.library.getLibrary, async () =>
			describe(),
		),
		[ipcContract.library.completeSetup.channel]: handle(
			ipcContract.library.completeSetup,
			async () => {
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
			},
		),
		[ipcContract.library.takeOver.channel]: handle(ipcContract.library.takeOver, async () => {
			await library.takeOver()
			return describe()
		}),
		[ipcContract.library.chooseLibraryFolder.channel]: handle(
			ipcContract.library.chooseLibraryFolder,
			async () => {
				const picked = await ui.pickFolder(library.path)
				if (!picked) return null
				const { path, studyId } = picked
				if (path === library.path) {
					if (!studyId) return null
					await data.update((settings) => {
						settings.preferences.lastOpenedStudyId = studyId
					})
					return describe()
				}
				await library.flush()
				const next = openLibrary(path)
				if (initialized) await next.initialize()
				try {
					await data.update((settings) => {
						settings.libraryPath = path
						if (studyId) settings.preferences.lastOpenedStudyId = studyId
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
			},
		),
		[ipcContract.library.listStudies.channel]: handle(ipcContract.library.listStudies, () =>
			!initialized ? Promise.resolve([]) : library.list(),
		),
		[ipcContract.library.openStudy.channel]: handle(
			ipcContract.library.openStudy,
			({ studyId }) => library.open(studyId),
			'Margin couldn’t open this study. Restore a backup or open another study.',
		),
		[ipcContract.library.createStudy.channel]: handle(
			ipcContract.library.createStudy,
			({ title, document }) => library.create(title, document),
		),
		[ipcContract.library.saveStudy.channel]: handle(
			ipcContract.library.saveStudy,
			({ study, sequence, base }) => {
				validateStudyDocument(study)
				return library.save(study, sequence, base)
			},
			'Margin couldn’t save your changes. Check that you can save files in the library folder, then try again or save a copy.',
		),
		[ipcContract.library.closeStudy.channel]: handle(
			ipcContract.library.closeStudy,
			async ({ studyId }) => {
				await library.closeStudy(studyId)
				return null
			},
		),
		[ipcContract.library.stageStudy.channel]: handle(
			ipcContract.library.stageStudy,
			async ({ study, sequence }) => {
				validateStudyDocument(study)
				library.stage(study, sequence)
				return null
			},
		),
		[ipcContract.library.deleteStudy.channel]: handle(
			ipcContract.library.deleteStudy,
			async ({ studyId }) => {
				await library.delete(studyId)
				return null
			},
		),
		[ipcContract.library.flush.channel]: handle(ipcContract.library.flush, async () => {
			await library.flush()
			return null
		}),
		[ipcContract.prefs.get.channel]: handle(
			ipcContract.prefs.get,
			async () => data.preferences,
			'Margin couldn’t load your settings. Restart Margin and try again.',
		),
		[ipcContract.prefs.set.channel]: handle(
			ipcContract.prefs.set,
			async (patch) => {
				await data.update((settings) => {
					Object.assign(settings.preferences, patch)
				})
				if ('appearance' in patch) ui.appearanceChanged(data.preferences)
				return data.preferences
			},
			'Margin couldn’t save your settings. Try again.',
		),
		[ipcContract.camera.get.channel]: handle(
			ipcContract.camera.get,
			async ({ studyId }) => data.camera(studyId),
			'Margin couldn’t restore the canvas view. Close the study and open it again.',
		),
		[ipcContract.camera.set.channel]: handle(
			ipcContract.camera.set,
			async ({ studyId, camera }) => {
				await data.update((settings) => {
					settings.cameras[studyId] = camera
				})
				return null
			},
			'Margin couldn’t save the canvas view. Try again.',
		),
	}

	async function requestClose({ quit }: { quit: boolean }): Promise<boolean> {
		const keepOpen = () => {
			ui.emit({ kind: 'keep-open' })
			return false
		}
		let snapshotsKnown = false
		try {
			const report = await ui.requestRendererFlush()
			snapshotsKnown =
				report === true ||
				(typeof report === 'object' &&
					report.dirty.every(({ studyId, sequence }) => library.hasSnapshot(studyId, sequence)))
			if (report !== true) throw new Error('The latest changes could not be saved.')
			await library.flush()
			return true
		} catch (error) {
			diagnostics.failure('close-flush-failed', error)
			const cause = errorMessage(error)
			const choice = await ui.confirmDiscard({
				message: 'Margin couldn’t save your latest changes',
				detail: [
					cause === SAVE_FALLBACK ? null : cause,
					snapshotsKnown
						? 'Keep Margin open to try again or save a copy. If you continue, Margin will try to keep a recovery copy.'
						: 'Margin couldn’t confirm it received your latest changes. Keep Margin open to try again. If you continue, you may lose those changes.',
				]
					.filter(Boolean)
					.join('\n\n'),
				quit,
				loseChanges: !snapshotsKnown,
			})
			if (choice === 'keep') return keepOpen()
			const { preserved, failed } = await library.preserveUnsaved()
			diagnostics.event('quit-with-unsaved', { preserved: preserved.length, failed: failed.length })
			if (failed.length) {
				const choice = await ui.confirmDiscard({
					message: 'Margin couldn’t keep a recovery copy of these studies',
					detail: `${failed.map(({ title }) => title).join('\n')}\n\nKeep Margin open to try again or save a copy. If you ${quit ? 'quit' : 'close'} now, you will lose the unsaved changes in these studies.`,
					quit,
					loseChanges: true,
				})
				if (choice === 'keep') return keepOpen()
				for (const { id } of failed) library.abandon(id)
			}
			for (const id of preserved) library.abandon(id)
			return true
		}
	}
	return { data, handlers, requestClose, close: () => library.close() }
}
