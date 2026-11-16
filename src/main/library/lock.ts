import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import { readFile, open, rm, link, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { atomicWrite } from './atomic'
const lockSchema = z.object({
	pid: z.number().int().positive(),
	hostname: z.string(),
	acquiredAt: z.string().optional(),
})
export type LibraryLockOwner = z.infer<typeof lockSchema>

export interface LibraryLock {
	readOnly: boolean
	/** The owner of a lock that made the library read-only; null when acquired or unreadable. */
	owner: LibraryLockOwner | null
	release: () => Promise<void>
	/** Replaces a lock held by another host. Same-host owners are never displaced. */
	takeOver: () => Promise<LibraryLock['release'] | null>
}

const lockContent = () =>
	JSON.stringify({ pid: process.pid, hostname: hostname(), acquiredAt: new Date().toISOString() })

// lockf releases the local acquisition guard on exit, including a crash; the guard file stays.
async function guarded<T>(path: string, action: () => Promise<T>): Promise<T> {
	const guard = spawn('/usr/bin/lockf', [
		'-k',
		'-t',
		'5',
		`${path}.guard`,
		'/bin/sh',
		'-c',
		'printf ready; cat >/dev/null',
	])
	const exited = new Promise<void>((resolve) => guard.once('close', () => resolve()))
	try {
		await new Promise<void>((resolve, reject) => {
			guard.once('error', reject)
			guard.stdout.once('data', () => resolve())
			guard.once('exit', () => reject(new Error('Could not acquire the library lock guard.')))
		})
		return await action()
	} finally {
		guard.stdin.end()
		await exited
	}
}
const releaser = (path: string, content: string) => () =>
	guarded(path, async () => {
		if ((await readFile(path, 'utf8').catch(() => '')) === content) await rm(path, { force: true })
	})

export async function acquireLibraryLock(folder: string): Promise<LibraryLock> {
	const path = join(folder, '.margin-lock')
	let owner: LibraryLockOwner | null = null
	const takeOver = () =>
		guarded(path, async () => {
			if (!owner || owner.hostname === hostname()) return null
			const current = lockSchema.parse(JSON.parse(await readFile(path, 'utf8')))
			if (JSON.stringify(current) !== JSON.stringify(owner)) return null
			const content = lockContent()
			await atomicWrite(path, content)
			owner = null
			return releaser(path, content)
		})
	return guarded(path, async () => {
		for (let attempt = 0; attempt < 2; attempt++) {
			const content = lockContent()
			const temporary = join(folder, `.${randomUUID()}.lock.tmp`)
			try {
				const file = await open(temporary, 'wx', 0o600)
				try {
					await file.writeFile(content)
					await file.sync()
				} finally {
					await file.close()
				}
				await link(temporary, path)
				return { readOnly: false, owner: null, release: releaser(path, content), takeOver }
			} catch (error) {
				if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
				let lock: LibraryLockOwner
				try {
					lock = lockSchema.parse(JSON.parse(await readFile(path, 'utf8')))
				} catch (error) {
					if (!(error instanceof SyntaxError || error instanceof z.ZodError)) throw error
					if (Date.now() - (await stat(path)).mtimeMs < 10_000) break
					await rm(path)
					continue
				}
				owner = lock
				if (lock.hostname !== hostname()) break
				try {
					process.kill(lock.pid, 0)
					break
				} catch (error) {
					if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) break
				}
				await rm(path)
			} finally {
				await rm(temporary, { force: true })
			}
		}
		return { readOnly: true, owner, release: async () => {}, takeOver }
	})
}
