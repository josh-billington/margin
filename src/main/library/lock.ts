import { hostname } from 'node:os'
import { readFile, open, rm } from 'node:fs/promises'
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

const releaser = (path: string, content: string) => async () => {
	if ((await readFile(path, 'utf8').catch(() => '')) === content) await rm(path, { force: true })
}

export async function acquireLibraryLock(folder: string): Promise<LibraryLock> {
	const path = join(folder, '.margin-lock')
	let owner: LibraryLockOwner | null = null
	const takeOver = async () => {
		if (!owner || owner.hostname === hostname()) return null
		const content = lockContent()
		await atomicWrite(path, content)
		owner = null
		return releaser(path, content)
	}
	for (let attempt = 0; attempt < 2; attempt++) {
		const content = lockContent()
		try {
			const file = await open(path, 'wx', 0o600)
			try {
				await file.writeFile(content)
				await file.sync()
			} finally {
				await file.close()
			}
			return { readOnly: false, owner: null, release: releaser(path, content), takeOver }
		} catch (error) {
			if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
			try {
				const lock = lockSchema.parse(JSON.parse(await readFile(path, 'utf8')))
				owner = lock
				if (lock.hostname !== hostname()) break
				try {
					process.kill(lock.pid, 0)
					break
				} catch (error) {
					if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) break
				}
				await rm(path)
			} catch {
				break
			}
		}
	}
	return { readOnly: true, owner, release: async () => {}, takeOver }
}
