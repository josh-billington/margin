import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc/register'
import { registerPersistence } from './ipc/persistence'
import { installAppMenu } from './menu'
import { createMainWindow } from './window/create'
import { applyAppearance } from './window/appearance'

let mainWindow: BrowserWindow | null = null
const getWindow = () => mainWindow

let liquidGlass: boolean | undefined

function openWindow() {
	mainWindow = createMainWindow(
		() => {
			mainWindow = null
		},
		{ liquidGlass },
	)
}

/** Single-instance lock, startup order, and macOS activate / quit behavior. */
export function runApp() {
	app.setName('Margin')
	// Test-only redirect so automated runs never touch the real app data or library.
	if (process.env.MARGIN_USER_DATA_DIR) app.setPath('userData', process.env.MARGIN_USER_DATA_DIR)
	if (!app.requestSingleInstanceLock()) {
		app.quit()
		return
	}
	app.on('second-instance', () => {
		if (mainWindow?.isMinimized()) mainWindow.restore()
		mainWindow?.focus()
	})
	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') app.quit()
	})
	void app.whenReady().then(async () => {
		if (!app.isPackaged && process.platform === 'darwin')
			app.dock?.setIcon(join(app.getAppPath(), 'resources/icon/margin-dark-1024.png'))
		registerIpcHandlers(getWindow)
		const data = await registerPersistence(getWindow, (preferences) => {
			applyAppearance(preferences.appearance)
			installAppMenu(getWindow, preferences.appearance)
		})
		liquidGlass = data.preferences.liquidGlass
		applyAppearance(data.preferences.appearance)
		installAppMenu(getWindow, data.preferences.appearance)
		openWindow()
		app.on('activate', () => {
			if (BrowserWindow.getAllWindows().length === 0) openWindow()
		})
	})
}
