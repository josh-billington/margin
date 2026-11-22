import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

const dialog = vi.hoisted(() => ({ showOpenDialog: vi.fn() }))
vi.mock('electron', () => ({
	app: { on: vi.fn() },
	dialog,
	ipcMain: { on: vi.fn() },
	clipboard: { writeText: vi.fn() },
	Menu: { buildFromTemplate: () => ({ popup: () => {} }) },
}))

import { createHostUi, libraryPathFromSelection } from './ui'

const studyId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
let root: string
afterEach(async () => {
	dialog.showOpenDialog.mockReset()
	if (root) await rm(root, { recursive: true, force: true })
})

it('treats a study file or its studies folder as that library', async () => {
	root = await mkdtemp(join(tmpdir(), 'margin-pick-'))
	const library = join(root, 'Margin')
	const studies = join(library, 'studies')
	await mkdir(studies, { recursive: true })
	const study = join(studies, `${studyId}.study.json`)
	await writeFile(study, '{}')
	await writeFile(join(library, 'library.json'), '{}')
	await writeFile(join(root, 'notes.json'), '{}')

	await expect(libraryPathFromSelection(study)).resolves.toEqual({ path: library, studyId })
	await expect(libraryPathFromSelection(studies)).resolves.toEqual({ path: library })
	await expect(libraryPathFromSelection(join(library, 'library.json'))).resolves.toEqual({
		path: library,
	})
	await expect(libraryPathFromSelection(library)).resolves.toEqual({ path: library })
	await expect(libraryPathFromSelection(join(root, 'notes.json'))).resolves.toBeNull()
	await expect(libraryPathFromSelection(join(root, 'new-library'))).resolves.toEqual({
		path: join(root, 'new-library'),
	})
})

it('asks for a study file or a folder, on the window', async () => {
	const window = { isDestroyed: () => false }
	dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
	const ui = createHostUi({
		getWindow: () => window as unknown as Electron.BrowserWindow,
		onAppearanceChange: () => {},
	})
	await expect(ui.pickFolder('/Users/reader/Documents/Margin')).resolves.toBeNull()
	expect(dialog.showOpenDialog).toHaveBeenCalledWith(
		window,
		expect.objectContaining({
			defaultPath: '/Users/reader/Documents/Margin',
			properties: ['openFile', 'openDirectory', 'createDirectory'],
		}),
	)
})
