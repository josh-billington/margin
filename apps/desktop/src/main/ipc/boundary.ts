import { ipcMain, type BrowserWindow } from 'electron'
import type { z } from 'zod'

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
