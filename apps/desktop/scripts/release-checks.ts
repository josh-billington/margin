import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { SQLInputValue } from 'node:sqlite'
import { parseEnv } from 'node:util'
import { BibleService } from '@margin/services/bible/provider'
import { searchBible } from '@margin/services/bible/search'
import { LexiconService } from '@margin/services/lexicon/service'
import type { Database } from '@margin/services/ports'

const genesis = { book: 'GEN', chapter: 1, verse: 1 } as const

/** The runtime services read through this port; Electron's better-sqlite3 build cannot load in Node. */
function openReadOnly(path: string): Database {
	if (!statSync(path, { throwIfNoEntry: false })?.isFile())
		throw new Error('Database file is missing.')
	// Packaging leaves sidecars behind, so committed pages must all be in the main file.
	if (statSync(`${path}-wal`, { throwIfNoEntry: false })?.size)
		throw new Error('It has an uncheckpointed write-ahead log. Close any importer and re-import.')
	const db = new DatabaseSync(path, { readOnly: true })
	const args = (params: readonly unknown[]) => params as SQLInputValue[]
	return {
		get: async (sql, params = []) => db.prepare(sql).get(...args(params)),
		all: async (sql, params = []) => db.prepare(sql).all(...args(params)),
		userVersion: async () => Number(db.prepare('PRAGMA user_version').get()?.user_version),
		close: async () => db.close(),
	}
}

/** Problems that would ship a reader without working Scripture, search or dictionaries. */
export async function releaseAssetErrors(resources: string): Promise<string[]> {
	const errors: string[] = []
	const fail = (name: 'bible' | 'lexicon', path: string, error: unknown) =>
		errors.push(
			`The ${name} database at ${path} is not usable: ${error instanceof Error ? error.message : 'check failed.'} Run pnpm import:${name}.`,
		)
	const biblePath = join(resources, 'bible', 'margin-bible.sqlite')
	const lexiconPath = join(resources, 'lexicon', 'margin-lexicon.sqlite')
	let bible: BibleService | undefined
	try {
		const db = openReadOnly(biblePath)
		bible = await BibleService.open(db)
		const { counts } = await searchBible({
			db,
			request: { query: 'tender mercies', translation: { kind: 'edition', id: 'kjv' } },
		})
		if (!counts?.total) throw new Error('Searching the KJV for “tender mercies” found nothing.')
	} catch (error) {
		await bible?.close()
		bible = undefined
		fail('bible', biblePath, error)
	}
	let lexicon: LexiconService | undefined
	try {
		lexicon = await LexiconService.open({ db: openReadOnly(lexiconPath) })
		if (!(await lexicon.getEntry('H1254'))) throw new Error('Strong’s H1254 is missing.')
		if (!(await lexicon.getBdbEntries({ id: 'H1254' })).length)
			throw new Error('Brown-Driver-Briggs has no entry for H1254.')
		if (bible) {
			const text = await bible.getPassage('kjv', [{ start: genesis, end: genesis }])
			const last = text.verses[0]?.tokens.at(-1)?.i ?? 0
			const { status, spans } = await lexicon.lookupSelection({
				text,
				start: { verse: genesis, token: 0 },
				end: { verse: genesis, token: last },
			})
			if (status !== 'matched' || !spans.some(({ ids }) => ids.includes('H1254')))
				throw new Error('Its word links do not match the bundled KJV Genesis 1:1.')
		}
	} catch (error) {
		fail('lexicon', lexiconPath, error)
	} finally {
		await lexicon?.close()
		await bible?.close()
	}
	return errors
}

const licenceVariable = 'VITE_TLDRAW_LICENSE_KEY'

/** Vite reads these from the workspace root for a production build, later files winning. */
export function licenceErrors(env: NodeJS.ProcessEnv, root: string): string[] {
	let fromFiles: string | undefined
	for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
		try {
			fromFiles = parseEnv(readFileSync(join(root, name), 'utf8'))[licenceVariable] ?? fromFiles
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
				return [`Could not read ${name} to find ${licenceVariable}.`]
		}
	}
	// The value is never echoed: only whether one is present.
	return (env[licenceVariable] ?? fromFiles)?.trim()
		? []
		: [`Set ${licenceVariable} so the production canvas does not blank.`]
}

export function signingErrors(env: NodeJS.ProcessEnv): string[] {
	const has = (name: string) => Boolean(env[name]?.trim())
	const errors: string[] = []
	if (!has('CSC_NAME') && !(has('CSC_LINK') && has('CSC_KEY_PASSWORD')))
		errors.push(
			'Set CSC_NAME to your Developer ID Application identity (without the certificate prefix), or set CSC_LINK and CSC_KEY_PASSWORD to import that certificate and its private key.',
		)
	if (env.CSC_NAME?.trim() === '-')
		errors.push(
			'CSC_NAME must select a Developer ID Application identity; ad-hoc signing is not a release.',
		)
	if (env.CSC_IDENTITY_AUTO_DISCOVERY === 'false' && !has('CSC_NAME'))
		errors.push(
			'Unset CSC_IDENTITY_AUTO_DISCOVERY or set CSC_NAME so the Developer ID identity can be selected.',
		)
	// Match electron-builder's credential precedence so a partial scheme cannot shadow a complete one.
	const scheme =
		env.APPLE_ID || env.APPLE_APP_SPECIFIC_PASSWORD
			? ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']
			: env.APPLE_API_KEY || env.APPLE_API_KEY_ID || env.APPLE_API_ISSUER
				? ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']
				: ['APPLE_KEYCHAIN_PROFILE']
	const missing = scheme.filter((name) => !has(name))
	if (missing.length)
		errors.push(
			`Notarization credentials are missing: ${missing.join(', ')}. Set one complete scheme: APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID; APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER; or APPLE_KEYCHAIN_PROFILE (optional APPLE_KEYCHAIN).`,
		)
	return errors
}
