import { readdir, mkdir, rm, lstat, realpath, open, link, rename } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, dirname } from 'node:path'
import { UserFacingError } from '@margin/contract/errors'
import { watch } from 'chokidar'
import { FileError } from '@margin/services/ports'
import type { FileStore, FileWatch } from '@margin/services/ports'
import { atomicWrite } from './atomic'

async function writeExclusive(path: string, content: string) {
	const file = await open(path, 'wx', 0o600)
	try {
		await file.writeFile(content)
		await file.sync()
	} catch (error) {
		await rm(path, { force: true })
		throw error
	} finally {
		await file.close()
	}
}

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
	let selected: string | undefined
	const unsafe = () =>
		new UserFacingError(
			'Margin can’t use a linked or unexpected file inside this folder. Choose a different folder or restore the original file.',
		)
	const hasCode = (error: unknown, code: string) =>
		error instanceof Error && 'code' in error && error.code === code
	async function checked(path: string, createParents: boolean) {
		const parts = path === '' ? [] : path.split('/')
		if (parts.some((part) => !part || part === '.' || part === '..')) throw unsafe()
		if (!selected) {
			if (createParents) await mkdir(root, { recursive: true })
			selected ??= await realpath(root)
		}
		if ((await realpath(selected)) !== selected) throw unsafe()
		let parent = selected
		for (const part of parts.slice(0, -1)) {
			parent = join(parent, part)
			if (createParents) {
				await mkdir(parent).catch((error: unknown) => {
					if (!hasCode(error, 'EEXIST')) throw error
				})
			}
			if (!(await lstat(parent)).isDirectory()) throw unsafe()
		}
		const absolute = join(selected, ...parts)
		const leaf = await lstat(absolute).catch((error: unknown) => {
			if (!hasCode(error, 'ENOENT')) throw error
			return null
		})
		if (leaf && !leaf.isFile() && !leaf.isDirectory()) throw unsafe()
		return absolute
	}
	async function run<T>(
		path: string,
		action: (absolute: string) => Promise<T>,
		createParents = false,
	) {
		try {
			return await action(await checked(path, createParents))
		} catch (error) {
			throw fileError(error, path)
		}
	}
	return {
		read: (path) =>
			run(path, async (absolute) => {
				const file = await open(
					absolute,
					constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
				)
				try {
					if (!(await file.stat()).isFile()) throw unsafe()
					return await file.readFile('utf8')
				} finally {
					await file.close()
				}
			}),
		list: (path) => run(path, (absolute) => readdir(absolute)),
		writeAtomic: ({ path, content, beforeReplace }) =>
			run(
				path,
				(absolute) =>
					write(absolute, content, async () => {
						await checked(path, false)
						await beforeReplace?.()
					}),
				true,
			),
		createExclusive: ({ path, content }) =>
			run(path, async (absolute) => {
				const temporary = join(dirname(absolute), `.${crypto.randomUUID()}.lock.tmp`)
				try {
					await writeExclusive(temporary, content)
					try {
						await link(temporary, absolute)
					} catch (error) {
						if (!(
							error instanceof Error &&
							'code' in error &&
							['ENOTSUP', 'EOPNOTSUPP', 'EPERM', 'EXDEV', 'ENOSYS'].includes(String(error.code))
						))
							throw error
						await writeExclusive(absolute, content)
					}
					return true
				} catch (error) {
					if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return false
					throw error
				} finally {
					await rm(temporary, { force: true })
				}
			}),
		remove: (path) => run(path, (absolute) => rm(absolute)),
		makeDir: (path) =>
			run(
				path,
				async (absolute) => {
					await mkdir(absolute, { recursive: true })
				},
				true,
			),
		modifiedAt: (path) => run(path, async (absolute) => (await lstat(absolute)).mtimeMs),
		move: ({ from, to }) =>
			run(from, async (absolute) => rename(absolute, await checked(to, false))),
	}
}
export function createFileWatch(root: string): FileWatch {
	return {
		watch: ({ dir, onChange, onError }) => {
			const watcher = watch(join(root, dir), {
				followSymlinks: false,
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
