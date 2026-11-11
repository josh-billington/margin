import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { ipcContract } from '@shared/ipc/contract'
import { handleBibleRequest } from './bible'
import { handleLexiconRequest } from './lexicon'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
	for (const group of Object.values(ipcContract)) {
		for (const operation of Object.values(group)) {
			ipcMain.handle(operation.channel, async (event, payload: unknown) => {
				const window = getWindow()
				if (
					!window ||
					event.sender !== window.webContents ||
					event.senderFrame !== window.webContents.mainFrame
				) {
					return operation.response.parse({
						ok: false,
						error: { code: 'FORBIDDEN', message: 'Untrusted IPC sender.' },
					})
				}
				const parsed = operation.request.safeParse(payload)
				if (!parsed.success) {
					return operation.response.parse({
						ok: false,
						error: {
							code: 'INVALID_REQUEST',
							message: 'The request did not match the IPC schema.',
						},
					})
				}
				const lexiconResult = await handleLexiconRequest(operation.channel, parsed.data, window)
				if (lexiconResult !== undefined) return operation.response.parse(lexiconResult)
				const bibleResult = await handleBibleRequest(operation.channel, parsed.data)
				if (bibleResult !== undefined) return operation.response.parse(bibleResult)
				return operation.response.parse({
					ok: false,
					error: {
						code: 'NOT_IMPLEMENTED',
						message: `${operation.channel} is not implemented yet.`,
					},
				})
			})
		}
	}
}
