import { app, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc/register'
import { registerPersistence } from './ipc/persistence'
import { installAppMenu } from './menu'
import { createMainWindow } from './window/create'
import { applyAppearance } from './window/appearance'
import { initializeLogging, logEvent, logFailure } from './logger'
import { WEBSITE } from './help'
import type { Preferences } from '@shared/ipc/contract'

let mainWindow: BrowserWindow | null = null
const getWindow = () => mainWindow

let preferences: (() => Preferences) | null = null

function openWindow() {
	mainWindow = createMainWindow(
		() => {
			mainWindow = null
		},
		{
			liquidGlass: preferences?.().liquidGlass,
			// Read when each window opens, so a window reopened after the intro played skips it.
			intro: preferences?.().introSeen === false,
		},
	)
}

function showWindow() {
	if (!mainWindow) openWindow()
	if (mainWindow?.isMinimized()) mainWindow.restore()
	mainWindow?.focus()
}

/** Single-instance lock, startup order, and macOS activate / quit behavior. */
export function runApp() {
	app.setName('Margin')
	// Test-only redirect so automated runs never touch the real app data or library.
	if (process.env.MARGIN_USER_DATA_DIR) app.setPath('userData', process.env.MARGIN_USER_DATA_DIR)
	if (process.env.MARGIN_USER_DATA_DIR)
		app.setAppLogsPath(join(process.env.MARGIN_USER_DATA_DIR, 'logs'))
	if (!app.requestSingleInstanceLock()) {
		app.quit()
		return
	}
	initializeLogging(app.getPath('logs'))
	logEvent('app-start', {
		version: app.getVersion(),
		os: process.getSystemVersion(),
		arch: process.arch,
	})
	process.on('uncaughtExceptionMonitor', (error) => logFailure('uncaught-exception', error, true))
	process.on('unhandledRejection', (error: unknown) => {
		logFailure('unhandled-rejection', error, true)
	})
	app.on('browser-window-created', (_event, window) => {
		window.webContents.on('render-process-gone', (_event, details) =>
			logEvent('render-process-gone', { reason: details.reason, exitCode: details.exitCode }),
		)
		window.on('unresponsive', () => logEvent('renderer-unresponsive'))
	})
	app.on('second-instance', () => {
		void startup.then(showWindow)
	})
	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') app.quit()
	})
	const startup = app.whenReady().then(async () => {
		app.setAboutPanelOptions({
			applicationName: 'Margin',
			applicationVersion: app.getVersion(),
			copyright: '© 2026 Josh Billington',
			website: WEBSITE,
		})
		if (!app.isPackaged && process.platform === 'darwin')
			app.dock?.setIcon(join(app.getAppPath(), 'resources/icon/margin-dark-1024.png'))
		registerIpcHandlers(getWindow)
		const data = await registerPersistence(getWindow, (preferences) => {
			applyAppearance(preferences.appearance)
			installAppMenu(getWindow, preferences.appearance)
		})
		preferences = () => data.preferences
		applyAppearance(data.preferences.appearance)
		installAppMenu(getWindow, data.preferences.appearance)
		openWindow()
		app.on('activate', showWindow)
	})
}
