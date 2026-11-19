import { afterEach, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
	events: new Map<string, () => void>(),
	closed: () => {},
	window: { isMinimized: vi.fn(() => true), restore: vi.fn(), focus: vi.fn() },
	create: vi.fn(),
}))
vi.mock('electron', () => ({
	app: {
		setName: vi.fn(),
		requestSingleInstanceLock: () => true,
		getPath: () => '/tmp',
		getVersion: () => 'test',
		on: (name: string, callback: () => void) => fake.events.set(name, callback),
		whenReady: async () => {},
		setAboutPanelOptions: vi.fn(),
		isPackaged: true,
	},
	BrowserWindow: { getAllWindows: () => [] },
}))
vi.mock('./window/create', () => ({
	createMainWindow: (closed: () => void) => {
		fake.closed = closed
		fake.create()
		return fake.window
	},
}))
vi.mock('./ipc/register', () => ({ registerIpcHandlers: vi.fn() }))
vi.mock('./ipc/persistence', () => ({
	registerPersistence: async () => ({ preferences: { liquidGlass: false, appearance: 'system' } }),
}))
vi.mock('./menu', () => ({ installAppMenu: vi.fn() }))
vi.mock('./window/appearance', () => ({ applyAppearance: vi.fn() }))
vi.mock('./logger', () => ({ initializeLogging: vi.fn(), logEvent: vi.fn(), logFailure: vi.fn() }))

const monitored = process.listeners('uncaughtExceptionMonitor')
const rejections = process.listeners('unhandledRejection')
afterEach(() => {
	for (const listener of process.listeners('uncaughtExceptionMonitor'))
		if (!monitored.includes(listener)) process.removeListener('uncaughtExceptionMonitor', listener)
	for (const listener of process.listeners('unhandledRejection'))
		if (!rejections.includes(listener)) process.removeListener('unhandledRejection', listener)
	vi.unstubAllGlobals()
})
it('reopens, restores and focuses the main window on second instance and activation', async () => {
	vi.stubGlobal(
		'process',
		Object.assign(Object.create(process), { getSystemVersion: () => 'test' }),
	)
	const { runApp } = await import('./lifecycle')
	runApp()
	await vi.waitFor(() => expect(fake.create).toHaveBeenCalledTimes(1))
	fake.closed()
	fake.events.get('second-instance')?.()
	await vi.waitFor(() => expect(fake.create).toHaveBeenCalledTimes(2))
	expect(fake.window.restore).toHaveBeenCalledTimes(1)
	expect(fake.window.focus).toHaveBeenCalledTimes(1)
	fake.events.get('second-instance')?.()
	await vi.waitFor(() => expect(fake.window.focus).toHaveBeenCalledTimes(2))
	expect(fake.create).toHaveBeenCalledTimes(2)
	fake.closed()
	fake.events.get('activate')?.()
	expect(fake.create).toHaveBeenCalledTimes(3)
	expect(fake.window.focus).toHaveBeenCalledTimes(3)
})
