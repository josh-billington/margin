import { UserFacingError } from '../../shared/errors'
import { afterEach, expect, it, vi } from 'vitest'
import { access, mkdtemp, readdir, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ipcContract } from '../../shared/ipc/contract'

const electron = vi.hoisted(() => ({
	handlers: new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>(),
	paths: { userData: '', documents: '' },
	selected: '',
	events: new Map<string, (event: { preventDefault: () => void }) => void>(),
	quit: vi.fn(),
	message: vi.fn(async (...args: unknown[]) => {
		void args
		return { response: 0 }
	}),
}))
vi.mock('electron', () => ({
	app: {
		getPath: (key: keyof typeof electron.paths) => electron.paths[key],
		on: (name: string, callback: (event: { preventDefault: () => void }) => void) =>
			electron.events.set(name, callback),
		quit: electron.quit,
	},
	dialog: {
		showMessageBox: electron.message,
		showOpenDialog: async () => ({ canceled: false, filePaths: [electron.selected] }),
	},
	ipcMain: {
		removeHandler: (channel: string) => electron.handlers.delete(channel),
		handle: (channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) =>
			electron.handlers.set(channel, handler),
		on: vi.fn(),
	},
}))
import { Library } from '../library/library'
import { describeFolder, errorMessage, registerPersistence } from './persistence'

let root: string
let closeLibrary: (() => Promise<unknown>) | undefined
afterEach(async () => {
	await closeLibrary?.().catch(() => {})
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

const home = '/Users/reader'
it.each([
	[home, { name: '~', location: '' }],
	[`${home}/Documents`, { name: 'Documents', location: '~' }],
	[`${home}/Documents/Margin`, { name: 'Margin', location: 'Documents' }],
	[`${home}/Projects/Margin`, { name: 'Margin', location: '~/Projects' }],
	[`${home}/Library/Mobile Documents/com~apple~CloudDocs`, { name: 'iCloud Drive', location: '' }],
	[
		`${home}/Library/Mobile Documents/com~apple~CloudDocs/Margin`,
		{ name: 'Margin', location: 'iCloud Drive' },
	],
	[
		`${home}/Library/Mobile Documents/com~apple~CloudDocs/Studies/Margin`,
		{ name: 'Margin', location: 'iCloud Drive/Studies' },
	],
	['/Volumes/Shared/Margin', { name: 'Margin', location: '/Volumes/Shared' }],
	['/Users/reader-other/Margin', { name: 'Margin', location: '/Users/reader-other' }],
	['/', { name: '/', location: '' }],
])('describes folder %s', (path, folder) => {
	expect(describeFolder(path, home)).toEqual(folder)
})

it('words file-system failures for the reader and keeps other messages', () => {
	const denied = Object.assign(new Error("EACCES: permission denied, open '/x/.tmp'"), {
		code: 'EACCES',
	})
	expect(errorMessage(denied)).toMatch(/^Margin doesn't have permission/)
	expect(errorMessage(denied)).not.toContain('/x/')
	expect(errorMessage(new UserFacingError('The study changed on disk.'))).toBe(
		'The study changed on disk.',
	)
	expect(errorMessage(new Error('internal detail'), 'Try again.')).toBe('Try again.')
	expect(errorMessage('plain')).not.toBe('plain')
})

it('keeps failed recovery studies open unless the user explicitly chooses to lose them', async () => {
	root = await mkdtemp(join(tmpdir(), 'margin-close-'))
	electron.paths = { userData: join(root, 'private'), documents: root }
	vi.stubEnv('MARGIN_LIBRARY_DIR', join(root, 'library'))
	const libraries: Library[] = []
	const initialize = Library.prototype.initialize
	vi.spyOn(Library.prototype, 'initialize').mockImplementation(function (this: Library) {
		libraries.push(this)
		closeLibrary = () => this.close()
		return initialize.call(this, false)
	})
	await registerPersistence(() => null)
	const library = libraries[0]
	if (!library) throw new Error('Missing library')
	const document = {
		store: {
			'page:page': {
				id: 'page:page',
				typeName: 'page',
				name: 'Page',
				index: 'a1',
				meta: { schemaVersion: 1, tags: [] },
			},
		},
		schema: { schemaVersion: 2, sequences: {} },
	}
	const kept = await library.create('Kept', document)
	const failed = await library.create('Needs preservation', document)
	library.stage({ ...kept, title: 'Kept edits' }, 1)
	library.stage({ ...failed, title: 'Edits at risk' }, 1)
	await mkdir(join(electron.paths.userData, 'recovery'), { recursive: true })
	await writeFile(join(electron.paths.userData, 'recovery', failed.id), 'blocked')
	electron.quit.mockClear()
	electron.message.mockResolvedValueOnce({ response: 1 }).mockResolvedValueOnce({ response: 0 })
	electron.events.get('before-quit')?.({ preventDefault: vi.fn() })
	await expect.poll(() => electron.message.mock.calls.length).toBe(2)
	await new Promise((resolve) => setImmediate(resolve))
	expect(electron.message.mock.calls[1]?.[0]).toMatchObject({
		detail: expect.stringContaining('Edits at risk'),
		buttons: ['Keep open', 'Quit and lose changes'],
	})
	expect([...library.stagedIds()]).toEqual([kept.id, failed.id])
	await library.save({ ...kept, title: 'Kept edits' }, 1)
	expect(electron.quit).not.toHaveBeenCalled()
	expect(await library.latestRecovery(kept.id)).toMatchObject({ title: 'Kept edits' })
	electron.message.mockResolvedValueOnce({ response: 1 }).mockResolvedValueOnce({ response: 1 })
	electron.events.get('before-quit')?.({ preventDefault: vi.fn() })
	await expect.poll(() => electron.quit.mock.calls.length).toBe(1)
	expect([...library.stagedIds()]).toEqual([])
})
