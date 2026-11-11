import { app, Menu } from 'electron'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import { COMMAND_CHANNEL } from '../shared/ipc/commands'
import type { AppCommandId } from '../shared/ipc/commands'
import type { Appearance } from '../shared/ipc/contract'

/**
 * Items dispatch renderer commands over IPC. Accelerators are display-only
 * (registerAccelerator: false) because the renderer's shortcut hook handles the keys itself;
 * otherwise the menu and the page would both fire.
 */
export function installAppMenu(
	getWindow: () => BrowserWindow | null,
	appearance: Appearance = 'system',
) {
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
				command('Look up word', 'word.lookup', 'Ctrl+Cmd+D'),
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
				command('Toggle Sidebar', 'sidebar.toggle', 'Cmd+\\'),
				{ type: 'separator' },
				command('Zoom to Fit', 'view.fit', 'Cmd+0'),
				command('Actual Size', 'view.actualSize', 'Cmd+1'),
				command('Zoom In', 'view.zoomIn'),
				command('Zoom Out', 'view.zoomOut'),
				{ type: 'separator' },
				{ role: 'togglefullscreen' },
				...(app.isPackaged
					? []
					: ([{ type: 'separator' }, { role: 'toggleDevTools' }] as MenuItemConstructorOptions[])),
			],
		},
		{ role: 'windowMenu' },
		{ role: 'help', submenu: [] },
	]
	Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
