import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { SIDEBAR_CHANNEL } from '@shared/ipc/commands'
import { setSidebarShown } from '../menu'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
	ipcMain.on(SIDEBAR_CHANNEL, (event, shown: unknown) => {
		if (event.sender === getWindow()?.webContents && typeof shown === 'boolean')
			setSidebarShown(shown)
	})
}
