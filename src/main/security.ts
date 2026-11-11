import type { BrowserWindow } from 'electron'

/**
 * Lock down the renderer. The Content-Security-Policy ships in renderer/index.html;
 * here we deny new windows, navigation, and every permission request.
 */
export function hardenWebContents(window: BrowserWindow) {
	const { webContents } = window
	webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
	webContents.on('will-navigate', (event) => event.preventDefault())
	webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
		callback(false),
	)
	webContents.session.setPermissionCheckHandler(() => false)
}
