import { z } from 'zod'
import { FileError, lockOwnerSchema as lockSchema } from '../ports'
import type { FileStore, HostIdentity, Clock, LibraryLockOwner } from '../ports'
export type { LibraryLockOwner } from '../ports'
export interface LibraryLock {
	readOnly: boolean
	/** The owner of a lock that made the library read-only; null when acquired or unreadable. */
	owner: LibraryLockOwner | null
	release: () => Promise<void>
	/** Replaces a lock held by another host. Same-host owners are never displaced. */
	takeOver: () => Promise<LibraryLock['release'] | null>
}

// Another process is already excluded by the single-instance lock; this orders overlapping calls in this one.
const queues = new Map<string, Promise<unknown>>()
function serial<T>(path: string, action: () => Promise<T>): Promise<T> {
	const next = (queues.get(path) ?? Promise.resolve()).then(action, action)
	queues.set(
		path,
		next.catch(() => {}),
	)
	return next
}

export async function acquireLibraryLock({
	files,
	host,
	clock,
	scope,
}: {
	files: FileStore
	host: HostIdentity
	clock: Clock
	scope: string
}): Promise<LibraryLock> {
	const path = '.margin-lock'
	const run = <T>(action: () => Promise<T>) => serial(scope, action)
	const content = () => JSON.stringify(host.current())
	const releaser = (owned: string) => () =>
		run(async () => {
			if ((await files.read(path).catch(() => '')) === owned)
				await files.remove(path).catch((error) => {
					if (!(error instanceof FileError && error.kind === 'missing')) throw error
				})
		})
	let owner: LibraryLockOwner | null = null
	const takeOver = () =>
		run(async () => {
			if (!owner || owner.hostname === host.current().hostname) return null
			const current = lockSchema.parse(JSON.parse(await files.read(path)))
			if (JSON.stringify(current) !== JSON.stringify(owner)) return null
			const owned = content()
			await files.writeAtomic({ path, content: owned })
			owner = null
			return releaser(owned)
		})
	return run(async () => {
		for (let attempt = 0; attempt < 2; attempt++) {
			const owned = content()
			if (await files.createExclusive({ path, content: owned }))
				return { readOnly: false, owner: null, release: releaser(owned), takeOver }
			let lock: LibraryLockOwner
			try {
				lock = lockSchema.parse(JSON.parse(await files.read(path)))
			} catch (error) {
				if (!(error instanceof SyntaxError || error instanceof z.ZodError)) throw error
				if (clock.now() - (await files.modifiedAt(path)) < 10_000) break
				await files.remove(path)
				continue
			}
			owner = lock
			if (lock.hostname !== host.current().hostname || host.isAlive(lock)) break
			await files.remove(path)
		}
		return { readOnly: true, owner, release: async () => {}, takeOver }
	})
}
