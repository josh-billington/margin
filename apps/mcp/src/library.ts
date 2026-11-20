import type { Stats } from 'node:fs'
import { constants } from 'node:fs'
import { lstat, open, readFile, readdir, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { UnsupportedStudyVersion } from '@margin/contract/study/migrations'
import { ulidSchema } from '@margin/contract/study/types'
import { z } from 'zod'
import { parseStudy } from './study'
import type { Study } from './study'

const studySuffix = '.study.json'
const preferences = z.object({ libraryPath: z.string().trim().min(1).optional() })

export async function resolveLibraryPath({
	args,
	env,
	home,
}: {
	args: string[]
	env: NodeJS.ProcessEnv
	home: string
}) {
	const { values } = parseArgs({ args, options: { library: { type: 'string' } } })
	if (values.library !== undefined && !values.library.trim()) {
		throw new Error('--library requires a directory.')
	}
	const preferred = values.library ?? env.MARGIN_LIBRARY_DIR?.trim()
	if (preferred) return absolutePath({ path: preferred, home })
	try {
		const contents = await readFile(
			join(home, 'Library', 'Application Support', 'Margin', 'prefs.json'),
			'utf8',
		)
		const { libraryPath } = preferences.parse(JSON.parse(contents))
		if (libraryPath) return absolutePath({ path: libraryPath, home })
	} catch {
		return join(home, 'Documents', 'Margin')
	}
	return join(home, 'Documents', 'Margin')
}

function absolutePath({ path, home }: { path: string; home: string }) {
	if (path === '~') return home
	return path.startsWith('~/') ? resolve(home, path.slice(2)) : resolve(path)
}

class LibraryError extends Error {}

const isMissing = (error: unknown) =>
	error instanceof Error && 'code' in error && error.code === 'ENOENT'

export const libraryErrorMessage = (error: unknown) =>
	error instanceof LibraryError ? error.message : 'Margin could not read the library.'

const sameFile = (first: Stats, second: Stats) =>
	first.dev === second.dev && first.ino === second.ino

export function openLibrary(path: string) {
	async function directoryIdentity(directory: string) {
		try {
			const info = await lstat(directory)
			if (info.isDirectory() && (await realpath(directory)) === directory) return info
		} catch {
			throw unreadableDirectory()
		}
		throw unreadableDirectory()
	}

	function unreadableDirectory() {
		return new LibraryError(
			'Cannot read the Margin studies folder. Check --library or MARGIN_LIBRARY_DIR. The studies folder must not be a symbolic link.',
		)
	}

	async function openStudiesDirectory() {
		const root = await realpath(path).catch(() => {
			throw unreadableDirectory()
		})
		const directory = join(root, 'studies')
		const identity = await directoryIdentity(directory)
		return {
			path: directory,
			async verify() {
				if (!sameFile(identity, await directoryIdentity(directory))) throw unreadableDirectory()
			},
		}
	}

	async function readStudyFrom(
		id: string,
		directory: Awaited<ReturnType<typeof openStudiesDirectory>>,
	) {
		if (!ulidSchema.safeParse(id).success)
			throw new LibraryError('Invalid study ID. Use list_studies to find study IDs.')
		try {
			await directory.verify()
			const file = join(directory.path, `${id}${studySuffix}`)
			const identity = await lstat(file)
			if (!identity.isFile()) throw new Error('Not a regular file')
			const handle = await open(
				file,
				constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
			)
			let content: string
			try {
				const opened = await handle.stat()
				if (
					!opened.isFile() ||
					!sameFile(identity, opened) ||
					!sameFile(opened, await lstat(file))
				) {
					throw new Error('Study file changed before reading')
				}
				await directory.verify()
				content = await handle.readFile('utf8')
				await directory.verify()
			} finally {
				await handle.close()
			}
			const study = parseStudy(JSON.parse(content))
			if (study.id !== id) throw new LibraryError(`Study ${id} does not match its filename.`)
			return study
		} catch (error) {
			if (error instanceof LibraryError) throw error
			if (error instanceof UnsupportedStudyVersion) {
				throw new LibraryError(
					`Study ${id} needs a newer version of Margin (study format ${error.requiredVersion}). Update Margin and its MCP server.`,
				)
			}
			if (isMissing(error))
				throw new LibraryError(`No study found with ID ${id}. Use list_studies to find study IDs.`)
			throw new LibraryError(`Study ${id} is unreadable or has an invalid study format.`)
		}
	}

	async function readStudy(id: string) {
		return readStudyFrom(id, await openStudiesDirectory())
	}

	async function readStudies() {
		const directory = await openStudiesDirectory()
		const entries = await readdir(directory.path, { withFileTypes: true }).catch(() => {
			throw unreadableDirectory()
		})
		const studies: Study[] = []
		const warnings: { id: string; message: string }[] = []
		for (const entry of entries) {
			if (!entry.isFile() || !entry.name.endsWith(studySuffix)) continue
			const id = entry.name.slice(0, -studySuffix.length)
			if (!ulidSchema.safeParse(id).success) continue
			try {
				studies.push(await readStudyFrom(id, directory))
			} catch (error) {
				warnings.push({ id, message: libraryErrorMessage(error) })
			}
		}
		await directory.verify()
		studies.sort(
			(first, second) =>
				second.updatedAt.localeCompare(first.updatedAt) || first.id.localeCompare(second.id),
		)
		warnings.sort((first, second) => first.id.localeCompare(second.id))
		return { studies, warnings }
	}

	return { readStudy, readStudies }
}
