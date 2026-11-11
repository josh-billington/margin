import { afterEach, beforeEach, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppDataStore } from './store'
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
