import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type * as FsModule from 'node:fs/promises'
import { acquireLibraryLock, type LibraryLock } from './lock'

const injected = vi.hoisted(() => ({ fail: false, linkError: '' }))
vi.mock('node:fs/promises', async (original) => {
	const fs = await original<typeof FsModule>()
	return {
		...fs,
		link: async (...args: Parameters<typeof fs.link>) => {
			if (injected.linkError)
				throw Object.assign(new Error('Links unavailable'), { code: injected.linkError })
			return fs.link(...args)
		},
		open: async (...args: Parameters<typeof fs.open>) => {
			const handle = await fs.open(...args)
			if (injected.fail && args[1] === 'wx') {
				handle.writeFile = async () => {
					throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' })
				}
			}
			return handle
		},
	}
})
let root: string
const locks: LibraryLock[] = []
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'margin-lock-'))
})
afterEach(async () => {
	injected.fail = false
	injected.linkError = ''
	await Promise.all(locks.splice(0).map((lock) => lock.release()))
	await rm(root, { recursive: true, force: true })
})
it.each(['ENOTSUP', 'EPERM', 'EXDEV'])(
	'acquires just one owner on volumes that reject hard links: %s',
	async (code) => {
		injected.linkError = code
		const first = await acquireLibraryLock(root)
		locks.push(first)
		const owner = await readFile(join(root, '.margin-lock'), 'utf8')
		const second = await acquireLibraryLock(root)
		locks.push(second)
		expect([first.readOnly, second.readOnly]).toEqual([false, true])
		expect(await readFile(join(root, '.margin-lock'), 'utf8')).toBe(owner)
	},
)
it('leaves no partial lock after an interrupted write and can retry', async () => {
	injected.fail = true
	await expect(acquireLibraryLock(root)).rejects.toMatchObject({ code: 'ENOSPC' })
	expect(await readdir(root)).not.toContain('.margin-lock')
	injected.fail = false
	const lock = await acquireLibraryLock(root)
	locks.push(lock)
	expect(lock.readOnly).toBe(false)
	expect(JSON.parse(await readFile(join(root, '.margin-lock'), 'utf8')).pid).toBe(process.pid)
})
it.each(['', '{partial'])(
	'reclaims an old malformed lock exactly once under concurrent acquisition: %s',
	async (content) => {
		const path = join(root, '.margin-lock')
		await writeFile(path, content)
		const old = new Date(Date.now() - 20_000)
		await utimes(path, old, old)
		const acquired = await Promise.all(Array.from({ length: 8 }, () => acquireLibraryLock(root)))
		locks.push(...acquired)
		expect(acquired.filter((lock) => !lock.readOnly)).toHaveLength(1)
		const saved = await readFile(path, 'utf8')
		await Promise.all(acquired.filter((lock) => lock.readOnly).map((lock) => lock.release()))
		expect(await readFile(path, 'utf8')).toBe(saved)
	},
)
it('leaves a fresh incomplete lock alone during its grace period', async () => {
	await writeFile(join(root, '.margin-lock'), '')
	const lock = await acquireLibraryLock(root)
	locks.push(lock)
	expect(lock.readOnly).toBe(true)
	expect(await readFile(join(root, '.margin-lock'), 'utf8')).toBe('')
})
