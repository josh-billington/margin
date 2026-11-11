import { afterEach, expect, it, vi } from 'vitest'
import { access, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ipcContract } from '../../shared/ipc/contract'

const electron = vi.hoisted(() => ({
	handlers: new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>(),
	paths: { userData: '', documents: '' },
	selected: '',
}))
vi.mock('electron', () => ({
	app: { getPath: (key: keyof typeof electron.paths) => electron.paths[key], on: vi.fn() },
	dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [electron.selected] }) },
	ipcMain: {
		removeHandler: (channel: string) => electron.handlers.delete(channel),
		handle: (channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) =>
			electron.handlers.set(channel, handler),
		on: vi.fn(),
	},
}))
import { Library } from '../library/library'
import { registerPersistence } from './persistence'

let root: string
let closeLibrary: (() => Promise<unknown>) | undefined
afterEach(async () => {
	await closeLibrary?.()
	vi.unstubAllEnvs()
	vi.restoreAllMocks()
	if (root) await rm(root, { recursive: true, force: true })
})
it('defers the default folder and creates no study when switching during setup', async () => {
	root = await mkdtemp(join(tmpdir(), 'margin-setup-'))
	electron.paths = { userData: join(root, 'userData'), documents: root }
	electron.selected = join(root, 'chosen')
	vi.stubEnv('MARGIN_LIBRARY_DIR', undefined)
	vi.stubEnv('MARGIN_DEFAULT_LIBRARY_DIR', join(root, 'default'))
	const webContents = { mainFrame: {}, send: vi.fn(), isDestroyed: () => true }
	const window = { webContents }
	const initialize = Library.prototype.initialize
	vi.spyOn(Library.prototype, 'initialize').mockImplementation(function (this: Library) {
		closeLibrary = () => this.close()
		return initialize.call(this, false)
	})
	const data = await registerPersistence(() => window as unknown as Electron.BrowserWindow)
	async function invoke(operation: { channel: string }, payload?: unknown) {
		const handler = electron.handlers.get(operation.channel)
		if (!handler) throw new Error('Missing handler')
		return handler({ sender: webContents, senderFrame: webContents.mainFrame }, payload)
	}
	await expect(access(join(root, 'default'))).rejects.toThrow()
	await expect(invoke(ipcContract.library.listStudies)).resolves.toEqual({ ok: true, data: [] })
	await invoke(ipcContract.library.chooseLibraryFolder)
	await expect(access(join(root, 'chosen'))).rejects.toThrow()
	await invoke(ipcContract.library.completeSetup)
	expect(data.setup).toBe('done')
	await expect(readdir(join(root, 'chosen', 'studies'))).resolves.toEqual([])
	await expect(access(join(root, 'default'))).rejects.toThrow()
	await invoke(ipcContract.library.completeSetup)
})
