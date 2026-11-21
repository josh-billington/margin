import { Encoding, Filesystem } from '@capacitor/filesystem'
import type { Directory } from '@capacitor/filesystem'
import { FileError } from '@margin/services/ports'
import type { FileStore } from '@margin/services/ports'
import { fileError } from './fileErrors'
import { nativeFiles } from './nativeFiles'

export function createFileStore({
	directory,
	root,
}: {
	directory: Directory
	root: string
}): FileStore {
	const absolute = (path: string) => [root, path].filter(Boolean).join('/')
	const queues = new Map<string, Promise<unknown>>()
	async function contents(path: string): ReturnType<typeof Filesystem.readdir> {
		if (path) await entry(path)
		return Filesystem.readdir({ path: absolute(path), directory })
	}
	async function entry(
		path: string,
	): Promise<Awaited<ReturnType<typeof Filesystem.readdir>>['files'][number]> {
		const separator = path.lastIndexOf('/')
		const parent = separator < 0 ? '' : path.slice(0, separator)
		const name = path.slice(separator + 1)
		const file = (await contents(parent)).files.find((file) => file.name === name)
		if (!file) throw new FileError('missing', path)
		return file
	}
	async function run<T>({ path, action }: { path: string; action: () => Promise<T> }) {
		try {
			return await action()
		} catch (error) {
			throw fileError({ error, path })
		}
	}
	const store: FileStore = {
		read: (path) =>
			run({
				path,
				action: async () => {
					await entry(path)
					const { data } = await Filesystem.readFile({
						path: absolute(path),
						directory,
						encoding: Encoding.UTF8,
					})
					if (typeof data !== 'string') throw new Error('Filesystem returned non-text data')
					return data
				},
			}),
		list: (path) =>
			run({
				path,
				action: async () => (await contents(path)).files.map((file) => file.name),
			}),
		writeAtomic: ({ path, content, beforeReplace }) =>
			run({
				path,
				action: async () => {
					const temporary = `${absolute(path)}.${crypto.randomUUID()}.tmp`
					let replaced = false
					try {
						await Filesystem.writeFile({
							path: temporary,
							directory,
							data: content,
							encoding: Encoding.UTF8,
							recursive: true,
						})
						await beforeReplace?.()
						const [from, to] = await Promise.all([
							Filesystem.getUri({ path: temporary, directory }),
							Filesystem.getUri({ path: absolute(path), directory }),
						])
						await nativeFiles.rename({ from: from.uri, to: to.uri })
						replaced = true
					} finally {
						if (!replaced)
							await Filesystem.deleteFile({ path: temporary, directory }).catch(() => {})
					}
				},
			}),
		createExclusive: ({ path, content }) => {
			const next = (queues.get(path) ?? Promise.resolve()).then(async () => {
				try {
					await store.modifiedAt(path)
					return false
				} catch (error) {
					if (!(error instanceof FileError && error.kind === 'missing')) throw error
				}
				await store.writeAtomic({ path, content })
				return true
			})
			queues.set(
				path,
				next.catch(() => {}),
			)
			return next
		},
		remove: (path) =>
			run({ path, action: () => Filesystem.deleteFile({ path: absolute(path), directory }) }),
		makeDir: (path) =>
			run({
				path,
				action: async () => {
					let parent = '.'
					for (const component of absolute(path).split('/').filter(Boolean)) {
						const children = await Filesystem.readdir({ path: parent, directory })
						const next = `${parent}/${component}`
						if (!children.files.some((file) => file.name === component))
							await Filesystem.mkdir({ path: next, directory })
						parent = next
					}
				},
			}),
		modifiedAt: (path) =>
			run({
				path,
				action: async () => (await entry(path)).mtime,
			}),
		move: ({ from, to }) =>
			run({
				path: from,
				action: () => Filesystem.rename({ from: absolute(from), to: absolute(to), directory }),
			}),
	}
	return store
}
