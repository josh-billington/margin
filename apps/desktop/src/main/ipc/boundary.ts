import { ipcContract } from '@shared/ipc/contract'
import { validateDocument } from '@shared/study/validation'
import { errorMessage } from '@margin/services/persistence'
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
	handleOperation(
		getWindow,
		ipcContract.library.getLibrary,
		handlers[ipcContract.library.getLibrary.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.library.completeSetup,
		handlers[ipcContract.library.completeSetup.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.library.chooseLibraryFolder,
		handlers[ipcContract.library.chooseLibraryFolder.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.library.createStudy,
		handlers[ipcContract.library.createStudy.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.library.listStudies,
		handlers[ipcContract.library.listStudies.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.library.openStudy,
		handlers[ipcContract.library.openStudy.channel],
	)
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
		return handlers[ipcContract.library.saveStudy.channel](request)
	})
	handleOperation(
		getWindow,
		ipcContract.library.closeStudy,
		handlers[ipcContract.library.closeStudy.channel],
	)
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
		return handlers[ipcContract.library.stageStudy.channel](request)
	})
	handleOperation(getWindow, ipcContract.library.flush, handlers[ipcContract.library.flush.channel])
	handleOperation(
		getWindow,
		ipcContract.library.takeOver,
		handlers[ipcContract.library.takeOver.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.library.deleteStudy,
		handlers[ipcContract.library.deleteStudy.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.bible.resolveReference,
		handlers[ipcContract.bible.resolveReference.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.bible.getPassage,
		handlers[ipcContract.bible.getPassage.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.bible.mapPassage,
		handlers[ipcContract.bible.mapPassage.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.bible.listTranslations,
		handlers[ipcContract.bible.listTranslations.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.lexicon.copyEntry,
		handlers[ipcContract.lexicon.copyEntry.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.lexicon.lookupSelection,
		handlers[ipcContract.lexicon.lookupSelection.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.lexicon.getEntry,
		handlers[ipcContract.lexicon.getEntry.channel],
	)
	handleOperation(
		getWindow,
		ipcContract.lexicon.contextMenu,
		handlers[ipcContract.lexicon.contextMenu.channel],
	)
	handleOperation(getWindow, ipcContract.prefs.get, handlers[ipcContract.prefs.get.channel])
	handleOperation(getWindow, ipcContract.prefs.set, handlers[ipcContract.prefs.set.channel])
	handleOperation(getWindow, ipcContract.camera.get, handlers[ipcContract.camera.get.channel])
	handleOperation(getWindow, ipcContract.camera.set, handlers[ipcContract.camera.set.channel])
}
