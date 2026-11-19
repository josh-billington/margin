import { readFile, readdir } from 'node:fs/promises'
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

export function openLibrary(path: string) {
	const studiesDirectory = join(path, 'studies')
	async function readStudy(id: string) {
		if (!ulidSchema.safeParse(id).success)
			throw new LibraryError('Invalid study ID. Use list_studies to find study IDs.')
		try {
			const content = await readFile(join(studiesDirectory, `${id}${studySuffix}`), 'utf8')
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

	async function readStudies() {
		const entries = await readdir(studiesDirectory, { withFileTypes: true }).catch(() => {
			throw new LibraryError(
				'Cannot read the Margin studies folder. Check --library or MARGIN_LIBRARY_DIR.',
			)
		})
		const studies: Study[] = []
		const warnings: { id: string; message: string }[] = []
		for (const entry of entries) {
			if (!entry.isFile() || !entry.name.endsWith(studySuffix)) continue
			const id = entry.name.slice(0, -studySuffix.length)
			if (!ulidSchema.safeParse(id).success) continue
			try {
				studies.push(await readStudy(id))
			} catch (error) {
				warnings.push({ id, message: libraryErrorMessage(error) })
			}
		}
		studies.sort(
			(first, second) =>
				second.updatedAt.localeCompare(first.updatedAt) || first.id.localeCompare(second.id),
		)
		warnings.sort((first, second) => first.id.localeCompare(second.id))
		return { studies, warnings }
	}

	return { readStudy, readStudies }
}
