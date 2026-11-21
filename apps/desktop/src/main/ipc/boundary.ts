import { flushReportSchema } from '@shared/ipc/contract'
import type { MarginHandlers } from '@margin/services/services'
import { ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'

const flushedSchema = z.object({ token: z.string(), ok: flushReportSchema })
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
	for (const [channel, handle] of Object.entries(handlers)) {
		ipcMain.removeHandler(channel)
		ipcMain.handle(channel, (event, payload: unknown) => {
			const window = getWindow()
			if (
				!window ||
				event.sender !== window.webContents ||
				event.senderFrame !== window.webContents.mainFrame
			)
				return {
					ok: false,
					error: {
						code: 'FORBIDDEN',
						message: 'Margin blocked a request from another window. Try again in the main window.',
					},
				}
			return handle(payload)
		})
	}
}
