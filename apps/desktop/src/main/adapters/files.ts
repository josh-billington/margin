import { readFile, readdir, mkdir, rm, stat, open, link, rename } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { watch } from 'chokidar'
import { FileError } from '@margin/services/ports'
import type { FileStore, FileWatch } from '@margin/services/ports'
import { atomicWrite } from './atomic'

export function fileError(error: unknown, path: string): unknown {
	if (!(error instanceof Error) || !('code' in error)) return error
	const kind = (() => {
		switch (error.code) {
			case 'ENOENT':
				return 'missing'
			case 'EEXIST':
				return 'exists'
			case 'EACCES':
			case 'EPERM':
				return 'denied'
			case 'EROFS':
				return 'readOnly'
			case 'ENOSPC':
				return 'full'
			default:
				return null
		}
	})()
	return kind
		? Object.assign(new FileError(kind, path, { cause: error }), { code: error.code })
		: error
}
export function createFileStore({
	root,
	write = atomicWrite,
}: {
	root: string
	write?: typeof atomicWrite
}): FileStore {
	async function run<T>(path: string, action: (absolute: string) => Promise<T>) {
		try {
			return await action(join(root, path))
		} catch (error) {
			throw fileError(error, path)
		}
	}
	return {
		read: (path) => run(path, (absolute) => readFile(absolute, 'utf8')),
		list: (path) => run(path, (absolute) => readdir(absolute)),
		writeAtomic: ({ path, content, beforeReplace }) =>
			run(path, (absolute) => write(absolute, content, beforeReplace)),
		createExclusive: ({ path, content }) =>
			run(path, async (absolute) => {
				const temporary = join(dirname(absolute), `.${crypto.randomUUID()}.lock.tmp`)
				try {
					const file = await open(temporary, 'wx', 0o600)
					try {
						await file.writeFile(content)
						await file.sync()
					} finally {
						await file.close()
					}
					try {
						await link(temporary, absolute)
						return true
					} catch (error) {
						if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return false
						throw error
					}
				} finally {
					await rm(temporary, { force: true })
				}
			}),
		remove: (path) => run(path, (absolute) => rm(absolute)),
		makeDir: (path) =>
			run(path, async (absolute) => {
				await mkdir(absolute, { recursive: true })
			}),
		modifiedAt: (path) => run(path, async (absolute) => (await stat(absolute)).mtimeMs),
		move: ({ from, to }) => run(from, (absolute) => rename(absolute, join(root, to))),
	}
}
export function createFileWatch(root: string): FileWatch {
	return {
		watch: ({ dir, onChange, onError }) => {
			const watcher = watch(join(root, dir), {
				ignoreInitial: true,
				awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 30 },
			})
			watcher.on('all', (_event, path) => onChange(path.split('/').pop() ?? path))
			watcher.on('error', onError)
			return {
				close: async () => {
					await watcher.close()
				},
			}
		},
	}
}
