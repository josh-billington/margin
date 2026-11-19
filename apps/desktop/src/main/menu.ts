import { app, Menu } from 'electron'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import { COMMAND_CHANNEL } from '@shared/ipc/commands'
import type { AppCommandId } from '@shared/ipc/commands'
import type { Appearance } from '@shared/ipc/contract'
import { checkForUpdates } from './updates'
import { feedbackUrl, openLink, revealLogs, WEBSITE } from './help'

let sidebarShown = true
let reinstall: (() => void) | null = null

/** The View menu names the sidebar action for the state it will change, like Finder and Mail. */
export function setSidebarShown(shown: boolean) {
	if (shown === sidebarShown) return
	sidebarShown = shown
	reinstall?.()
}

/**
 * Items dispatch renderer commands over IPC. Accelerators are display-only
 * (registerAccelerator: false) because the renderer's shortcut hook handles the keys itself;
 * otherwise the menu and the page would both fire.
 */
export function installAppMenu(
	getWindow: () => BrowserWindow | null,
	appearance: Appearance = 'system',
) {
	reinstall = () => installAppMenu(getWindow, appearance)
	const run = (id: AppCommandId) => () => {
		const window = getWindow()
		if (window && !window.webContents.isDestroyed()) window.webContents.send(COMMAND_CHANNEL, id)
	}
	const command = (
		label: string,
		id: AppCommandId,
		accelerator?: string,
	): MenuItemConstructorOptions => ({
		id,
		label,
		accelerator,
		registerAccelerator: false,
		click: run(id),
	})
	const template: MenuItemConstructorOptions[] = [
		{
			label: app.name,
			submenu: [
				{ role: 'about' },
				{ label: 'Check for Updates…', visible: !process.mas, click: () => void checkForUpdates() },
				{ type: 'separator' },
				command('Settings…', 'settings.open', 'Cmd+,'),
				{ type: 'separator' },
				{ role: 'services' },
				{ type: 'separator' },
				{ role: 'hide' },
				{ role: 'hideOthers' },
				{ role: 'unhide' },
				{ type: 'separator' },
				{ role: 'quit' },
			],
		},
		{
			label: 'File',
			submenu: [
				command('New Study', 'study.new', 'Cmd+N'),
				command('Add Verses…', 'passage.add'),
				{ type: 'separator' },
				{ role: 'close' },
			],
		},
		{
			label: 'Edit',
			submenu: [
				command('Undo', 'edit.undo', 'Cmd+Z'),
				command('Redo', 'edit.redo', 'Shift+Cmd+Z'),
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'selectAll' },
				{ type: 'separator' },
				command('Look Up Word', 'word.lookup', 'Ctrl+Cmd+D'),
				command('Command Palette…', 'palette.toggle', 'Cmd+K'),
			],
		},
		{
			label: 'View',
			submenu: [
				{
					label: 'Appearance',
					submenu: [
						{
							...command('System', 'appearance.system'),
							type: 'radio',
							checked: appearance === 'system',
						},
						{
							...command('Light', 'appearance.light'),
							type: 'radio',
							checked: appearance === 'light',
						},
						{
							...command('Dark', 'appearance.dark'),
							type: 'radio',
							checked: appearance === 'dark',
						},
					],
				},
				{ type: 'separator' },
				command(sidebarShown ? 'Hide Sidebar' : 'Show Sidebar', 'sidebar.toggle', 'Ctrl+Cmd+S'),
				{ type: 'separator' },
				// ⌘0 is Actual Size across macOS (Preview, Safari, Pages); canvas apps such as Sketch add
				// ⌘1 Zoom to Fit and ⌘2 Zoom to Selection.
				command('Actual Size', 'view.actualSize', 'Cmd+0'),
				command('Zoom to Fit', 'view.fit', 'Cmd+1'),
				command('Zoom In', 'view.zoomIn', 'Cmd+Plus'),
				command('Zoom Out', 'view.zoomOut', 'Cmd+-'),
				{ type: 'separator' },
				{ role: 'togglefullscreen' },
				...(app.isPackaged
					? []
					: ([{ type: 'separator' }, { role: 'toggleDevTools' }] as MenuItemConstructorOptions[])),
			],
		},
		{ role: 'windowMenu' },
		{
			role: 'help',
			submenu: [
				command('Show Welcome', 'intro.show'),
				{ type: 'separator' },
				{
					label: 'Send Feedback…',
					click: () =>
						openLink(feedbackUrl(app.getVersion(), process.getSystemVersion(), process.arch)),
				},
				{ label: 'Show Logs in Finder', click: revealLogs },
				{ type: 'separator' },
				{ label: 'Margin Website', click: () => openLink(WEBSITE) },
				{ label: 'Privacy Policy', click: () => openLink(`${WEBSITE}/privacy/`) },
			],
		},
	]
	Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
