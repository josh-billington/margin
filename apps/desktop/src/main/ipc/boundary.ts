import { ipcContract } from '@shared/ipc/contract'
import { validateDocument } from '@shared/study/validation'
import { errorMessage } from '@margin/services/persistence'
import { createServiceApi } from '@margin/services/api'
import type { MarginHandlers } from '@margin/services/services'
import { logFailure } from '../logger'
import { ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'

interface Operation<I extends z.ZodType, O extends z.ZodType> {
	channel: string
	request: I
	response: O
}

export function failure(operation: { response: z.ZodType }, code: string, message: string) {
	return operation.response.parse({ ok: false, error: { code, message } })
}

// The renderer-to-main boundary: only the main window's top frame may call, and every request is parsed here once.
export function handleOperation<I extends z.ZodType, O extends z.ZodType>(
	getWindow: () => BrowserWindow | null,
	operation: Operation<I, O>,
	action: (request: z.output<I>, window: BrowserWindow) => Promise<unknown>,
) {
	ipcMain.removeHandler(operation.channel)
	ipcMain.handle(operation.channel, async (event, payload: unknown) => {
		const window = getWindow()
		if (
			!window ||
			event.sender !== window.webContents ||
			event.senderFrame !== window.webContents.mainFrame
		)
			return failure(
				operation,
				'FORBIDDEN',
				'Margin blocked a request from another window. Try again in the main window.',
			)
		const parsed = operation.request.safeParse(payload)
		if (!parsed.success)
			return failure(operation, 'INVALID_REQUEST', 'Margin couldn’t read this request. Try again.')
		return action(parsed.data, window)
	})
}

const flushedSchema = z.object({ token: z.string(), ok: z.boolean() })
export function onRendererFlushed({
	getWindow,
	flushed,
}: {
	getWindow: () => BrowserWindow | null
	flushed: (payload: z.output<typeof flushedSchema>) => void
}) {
	ipcMain.on('margin:library:flushed', (event, payload: unknown) => {
		const window = getWindow()
		const parsed = flushedSchema.safeParse(payload)
		if (
			window &&
			event.sender === window.webContents &&
			event.senderFrame === window.webContents.mainFrame &&
			parsed.success
		)
			flushed(parsed.data)
	})
}

export function registerServiceHandlers({
	getWindow,
	handlers,
}: {
	getWindow: () => BrowserWindow | null
	handlers: MarginHandlers
}) {
	const api = createServiceApi({ handlers })
	handleOperation(getWindow, ipcContract.library.getLibrary, api.library.getLibrary)
	handleOperation(getWindow, ipcContract.library.completeSetup, api.library.completeSetup)
	handleOperation(
		getWindow,
		ipcContract.library.chooseLibraryFolder,
		api.library.chooseLibraryFolder,
	)
	handleOperation(getWindow, ipcContract.library.createStudy, api.library.createStudy)
	handleOperation(getWindow, ipcContract.library.listStudies, api.library.listStudies)
	handleOperation(getWindow, ipcContract.library.openStudy, api.library.openStudy)
	handleOperation(getWindow, ipcContract.library.saveStudy, async (request) => {
		try {
			validateDocument(request.study.document)
		} catch (error) {
			logFailure('persistence-operation-failed', error)
			return failure(
				ipcContract.library.saveStudy,
				'SAVE_FAILED',
				errorMessage(
					error,
					'Margin couldn’t save your changes. Check that you can save files in the library folder, then try again or save a copy.',
				),
			)
		}
		return api.library.saveStudy(request)
	})
	handleOperation(getWindow, ipcContract.library.closeStudy, api.library.closeStudy)
	handleOperation(getWindow, ipcContract.library.stageStudy, async (request) => {
		try {
			validateDocument(request.study.document)
		} catch (error) {
			logFailure('persistence-operation-failed', error)
			return failure(
				ipcContract.library.stageStudy,
				'SAVE_FAILED',
				errorMessage(
					error,
					'Margin couldn’t update the library. Check that you can open the library folder and try again.',
				),
			)
		}
		return api.library.stageStudy(request)
	})
	handleOperation(getWindow, ipcContract.library.flush, api.library.flush)
	handleOperation(getWindow, ipcContract.library.takeOver, api.library.takeOver)
	handleOperation(getWindow, ipcContract.library.deleteStudy, api.library.deleteStudy)
	handleOperation(getWindow, ipcContract.bible.resolveReference, api.bible.resolveReference)
	handleOperation(getWindow, ipcContract.bible.search, api.bible.search)
	handleOperation(getWindow, ipcContract.bible.getPassage, api.bible.getPassage)
	handleOperation(getWindow, ipcContract.bible.mapPassage, api.bible.mapPassage)
	handleOperation(getWindow, ipcContract.bible.listTranslations, api.bible.listTranslations)
	handleOperation(getWindow, ipcContract.lexicon.copyEntry, api.lexicon.copyEntry)
	handleOperation(getWindow, ipcContract.lexicon.lookupSelection, api.lexicon.lookupSelection)
	handleOperation(getWindow, ipcContract.lexicon.getEntry, api.lexicon.getEntry)
	handleOperation(getWindow, ipcContract.lexicon.contextMenu, api.lexicon.contextMenu)
	handleOperation(getWindow, ipcContract.prefs.get, api.prefs.get)
	handleOperation(getWindow, ipcContract.prefs.set, api.prefs.set)
	handleOperation(getWindow, ipcContract.camera.get, api.camera.get)
	handleOperation(getWindow, ipcContract.camera.set, api.camera.set)
}
