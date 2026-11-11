import { app, BrowserWindow, nativeTheme, screen } from 'electron'
import { join } from 'node:path'
import { hardenWebContents } from '../security'
import { APPEARANCE_ARGUMENT, APPEARANCE_CHANNEL, GLASS_ARGUMENT } from '../../shared/ipc/contract'
import { attachGlass, resolveGlassMode } from './glass'
import { resolvedAppearance, windowBackground } from './appearance'

/** If the renderer never reports ready-to-show, show anyway rather than leaving a hidden window. */
const SHOW_FALLBACK_MS = 4000

export function createMainWindow(
	onClosed: () => void,
	options: { liquidGlass?: boolean } = {},
): BrowserWindow {
	const glass = resolveGlassMode(options.liquidGlass)
	const isMac = process.platform === 'darwin'
	// Open filling the screen's usable area (below the menu bar, beside the Dock), like a zoomed
	// window rather than native full screen, so the canvas gets the room while chrome stays reachable.
	const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
	const window = new BrowserWindow({
		...workArea,
		minWidth: 760,
		minHeight: 520,
		show: false,
		title: 'Margin',
		// The glass view sits behind the web contents, so the window must be transparent for it to show.
		transparent: glass !== 'none',
		backgroundColor: glass === 'none' ? windowBackground() : '#00000000',
		titleBarStyle: isMac ? 'hiddenInset' : 'default',
		trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			additionalArguments: [
				`${GLASS_ARGUMENT}${glass}`,
				`${APPEARANCE_ARGUMENT}${resolvedAppearance()}`,
			],
		},
	})
	const reveal = () => {
		if (window.isDestroyed() || window.isVisible()) return
		window.show()
		// A freshly launched dev/CLI process is not frontmost; without this the window opens behind others.
		if (process.platform === 'darwin') app.focus({ steal: true })
		window.focus()
	}
	window.once('ready-to-show', reveal)
	const fallback = setTimeout(reveal, SHOW_FALLBACK_MS)
	window.on('closed', () => {
		clearTimeout(fallback)
		onClosed()
	})
	// An opaque window repaints its backdrop when the system appearance flips.
	const syncBackground = () => {
		if (window.isDestroyed()) return
		if (glass === 'none') window.setBackgroundColor(windowBackground())
		if (!window.webContents.isDestroyed())
			window.webContents.send(APPEARANCE_CHANNEL, resolvedAppearance())
	}
	nativeTheme.on('updated', syncBackground)
	window.on('closed', () => nativeTheme.removeListener('updated', syncBackground))
	hardenWebContents(window)
	attachGlass(window, glass)
	if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
		void window.loadURL(process.env.ELECTRON_RENDERER_URL)
	} else {
		void window.loadFile(join(__dirname, '../renderer/index.html'))
	}
	return window
}
