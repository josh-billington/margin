import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppDataStore } from './appData'
let root: string
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'margin-prefs-'))
})
afterEach(async () => {
	await rm(root, { recursive: true, force: true })
})
it('persists selected library, preferences and per-study cameras without clobbering concurrent updates', async () => {
	const data = await new AppDataStore(root).open()
	await Promise.all([
		data.update((settings) => {
			settings.libraryPath = '/my/library'
		}),
		data.update((settings) => {
			settings.preferences.defaultNoteFont = 'plain'
		}),
		data.update((settings) => {
			settings.cameras.study = { x: 1, y: 2, z: 0.5 }
		}),
	])
	const reopened = await new AppDataStore(root).open()
	expect(reopened.libraryPath).toBe('/my/library')
	expect(reopened.preferences.defaultNoteFont).toBe('plain')
	expect(reopened.camera('study')).toEqual({ x: 1, y: 2, z: 0.5 })
	expect(reopened.camera('missing')).toBeNull()
})

it('keeps setup pending when prefs.json is missing', async () => {
	const data = await new AppDataStore(root).open()
	expect(data.setup).toBe('pending')
})
it('opens preferences saved with the retired welcome intro flag and drops it', async () => {
	await writeFile(
		join(root, 'prefs.json'),
		JSON.stringify({
			setup: 'done',
			preferences: {
				defaultTranslation: 'kjv',
				oldTestamentTranslation: 'kjv',
				defaultNoteFont: 'plain',
				displayNotesInPlainFont: false,
				introSeen: true,
			},
		}),
	)
	const existing = await new AppDataStore(root).open()
	expect(existing.setup).toBe('done')
	expect(existing.preferences.defaultNoteFont).toBe('plain')
	expect(existing.preferences).not.toHaveProperty('introSeen')
	expect((await readdir(root)).some((name) => name.startsWith('prefs.json.bad-'))).toBe(false)
	await existing.update(() => {})
	expect(
		JSON.parse(await readFile(join(root, 'prefs.json'), 'utf8')).preferences,
	).not.toHaveProperty('introSeen')
})
it('skips setup for existing preferences without a setup field', async () => {
	await writeFile(join(root, 'prefs.json'), '{}')
	expect((await new AppDataStore(root).open()).setup).toBe('done')
})
it('completes setup idempotently and persists it', async () => {
	const data = await new AppDataStore(root).open()
	await data.completeSetup()
	await data.completeSetup()
	expect(data.setup).toBe('done')
	expect((await new AppDataStore(root).open()).setup).toBe('done')
})
it('skips setup when the library is supplied by the harness', async () => {
	vi.stubEnv('MARGIN_LIBRARY_DIR', join(root, 'library'))
	try {
		const data = await new AppDataStore(root).open()
		expect(data.setup).toBe('done')
		await data.update(() => {})
	} finally {
		vi.unstubAllEnvs()
	}
	expect((await new AppDataStore(root).open()).setup).toBe('done')
})

it.each(['{broken', '{"preferences":{"appearance":"invalid"}}'])(
	'keeps malformed preferences aside and opens with defaults: %s',
	async (content) => {
		await writeFile(join(root, 'prefs.json'), content)
		const data = await new AppDataStore(root).open()
		expect(data.setup).toBe('pending')
		expect(data.preferences.defaultTranslation).toBe('kjv')
		const backup = (await readdir(root)).find((name) => name.startsWith('prefs.json.bad-'))
		expect(backup).toBeDefined()
		expect(await readFile(join(root, backup!), 'utf8')).toBe(content)
		await data.completeSetup()
		expect((await new AppDataStore(root).open()).setup).toBe('done')
	},
)
