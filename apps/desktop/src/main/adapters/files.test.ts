import { afterEach, beforeEach, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFileStore } from './files'

const linked = /linked or unexpected file/
let folder: string
let root: string
let other: string
beforeEach(async () => {
	folder = await mkdtemp(join(tmpdir(), 'margin-store-'))
	root = join(folder, 'root')
	other = join(folder, 'other')
	await Promise.all([mkdir(root), mkdir(other)])
})
afterEach(() => rm(folder, { recursive: true, force: true }))

it('pins the real selected root when the folder picker returns an alias', async () => {
	const selected = join(folder, 'selected')
	await symlink(root, selected)
	const files = createFileStore({ root: selected })
	await files.makeDir('studies')
	await unlink(selected)
	await symlink(other, selected)
	await files.writeAtomic({ path: 'studies/test.study.json', content: 'local' })
	expect(await readFile(join(root, 'studies/test.study.json'), 'utf8')).toBe('local')
})
it('refuses linked study directories for listing and creation', async () => {
	await symlink(other, join(root, 'studies'))
	const files = createFileStore({ root })
	await expect(files.list('studies')).rejects.toThrow(linked)
	await expect(
		files.writeAtomic({ path: 'studies/test.study.json', content: 'local' }),
	).rejects.toThrow(linked)
})
it('rejects linked study leaves for reads and replacement', async () => {
	await mkdir(join(root, 'studies'))
	const path = 'studies/test.study.json'
	await writeFile(join(other, 'target'), 'original')
	await symlink(join(other, 'target'), join(root, path))
	const files = createFileStore({ root })
	await expect(files.read(path)).rejects.toThrow(linked)
	await expect(files.writeAtomic({ path, content: 'local' })).rejects.toThrow(linked)
	expect(await readFile(join(other, 'target'), 'utf8')).toBe('original')
})
it('refuses paths that climb out of the library', async () => {
	await mkdir(join(root, 'studies'))
	await writeFile(join(other, 'outside.study.json'), 'original')
	const files = createFileStore({ root })
	const path = 'studies/../../other/outside.study.json'
	await expect(files.read(path)).rejects.toThrow(linked)
	await expect(files.writeAtomic({ path, content: 'local' })).rejects.toThrow(linked)
	await expect(files.remove(path)).rejects.toThrow(linked)
	expect(await readFile(join(other, 'outside.study.json'), 'utf8')).toBe('original')
})
