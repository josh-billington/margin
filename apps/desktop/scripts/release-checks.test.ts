import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { licenceErrors, releaseAssetErrors, signingErrors } from './release-checks'

const bundled = resolve('resources')
const corpora = {
	bible: join('bible', 'margin-bible.sqlite'),
	lexicon: join('lexicon', 'margin-lexicon.sqlite'),
}
const haveCorpora = Object.values(corpora).every((path) => existsSync(join(bundled, path)))
const scratch: string[] = []
const tempDir = () => {
	const dir = mkdtempSync(join(tmpdir(), 'margin-release-'))
	scratch.push(dir)
	return dir
}
afterEach(() => {
	for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A resources folder holding copies of the bundled corpora, optionally altered. */
function resources(alter: Partial<Record<keyof typeof corpora, (db: DatabaseSync) => void>> = {}) {
	const dir = tempDir()
	for (const [name, path] of Object.entries(corpora)) {
		mkdirSync(join(dir, name), { recursive: true })
		copyFileSync(join(bundled, path), join(dir, path))
		const change = alter[name as keyof typeof corpora]
		if (!change) continue
		const db = new DatabaseSync(join(dir, path))
		change(db)
		db.close()
	}
	return dir
}

describe('release assets', () => {
	it('rejects a resources folder without the corpora', async () => {
		const errors = await releaseAssetErrors(tempDir())
		expect(errors).toHaveLength(2)
		expect(errors[0]).toMatch(/bible database .* Database file is missing\. Run pnpm import:bible/)
		expect(errors[1]).toMatch(
			/lexicon database .* Database file is missing\. Run pnpm import:lexicon/,
		)
	})

	it('rejects databases from another schema version', async () => {
		const dir = tempDir()
		for (const [name, path] of Object.entries(corpora)) {
			mkdirSync(join(dir, name))
			const db = new DatabaseSync(join(dir, path))
			db.exec('PRAGMA user_version = 2')
			db.close()
		}
		const errors = await releaseAssetErrors(dir)
		expect(errors[0]).toContain('Bible storage version 2 is not supported')
		expect(errors[1]).toContain('Unsupported lexicon schema version')
	})

	describe.skipIf(!haveCorpora)('with the imported corpora', () => {
		it('accepts the bundled databases', async () => {
			expect(await releaseAssetErrors(bundled)).toEqual([])
		})

		it('rejects a Bible whose search index cannot find “tender mercies”', async () => {
			const dir = resources({
				bible: (db) =>
					db.exec(`DROP TABLE verse_search_kjv;
						CREATE VIRTUAL TABLE verse_search_kjv USING fts5(text, content='', tokenize='ascii')`),
			})
			expect(await releaseAssetErrors(dir)).toEqual([
				expect.stringContaining('Searching the KJV for “tender mercies” found nothing.'),
			])
		})

		it('rejects a lexicon without Brown-Driver-Briggs H1254', async () => {
			const dir = resources({
				lexicon: (db) => db.exec(`DELETE FROM bdb_entries WHERE id = 'H1254'`),
			})
			expect(await releaseAssetErrors(dir)).toEqual([
				expect.stringContaining('Brown-Driver-Briggs has no entry for H1254.'),
			])
		})

		it('rejects a lexicon whose word links no longer match the Bible', async () => {
			const dir = resources({ lexicon: (db) => db.exec(`UPDATE verses SET fingerprint = 'stale'`) })
			expect(await releaseAssetErrors(dir)).toEqual([
				expect.stringContaining('word links do not match'),
			])
		})

		it('rejects a database with pages left in its write-ahead log', async () => {
			const dir = resources()
			writeFileSync(join(dir, `${corpora.bible}-wal`), 'pending')
			expect(await releaseAssetErrors(dir)).toEqual([
				expect.stringContaining('uncheckpointed write-ahead log'),
			])
		})
	})
})

describe('tldraw licence', () => {
	const key = 'VITE_TLDRAW_LICENSE_KEY'

	it('requires a key without revealing one', () => {
		const root = tempDir()
		writeFileSync(join(root, '.env'), `${key}=\n`)
		const errors = licenceErrors({}, root)
		expect(errors).toEqual([expect.stringContaining(key)])
		writeFileSync(join(root, '.env.production'), `${key}=secret-licence\n`)
		expect(licenceErrors({}, root)).toEqual([])
		expect(licenceErrors({ [key]: ' ' }, root)).toEqual([expect.not.stringContaining('secret')])
	})

	it('accepts a key from the environment', () => {
		expect(licenceErrors({ [key]: 'secret-licence' }, tempDir())).toEqual([])
	})
})

describe('signing', () => {
	it('requires signing and notarization credentials', () => {
		const errors = signingErrors({}).join('\n')
		expect(errors).toContain('Developer ID Application')
		expect(errors).toContain('Notarization credentials are missing')
	})

	it.each([
		{ APPLE_ID: 'owner@example.com', APPLE_APP_SPECIFIC_PASSWORD: 'test', APPLE_TEAM_ID: 'TEAM' },
		{ APPLE_API_KEY: '/private/key.p8', APPLE_API_KEY_ID: 'KEY', APPLE_API_ISSUER: 'ISSUER' },
		{ APPLE_KEYCHAIN_PROFILE: 'margin-notary' },
	])('accepts a complete notarization scheme: %j', (notary) => {
		expect(signingErrors({ CSC_NAME: 'Owner (TEAM)', ...notary })).toEqual([])
		expect(
			signingErrors({ CSC_LINK: '/private/certificate.p12', CSC_KEY_PASSWORD: 'test', ...notary }),
		).toEqual([])
	})

	it.each([
		{ CSC_NAME: '-' },
		{ CSC_LINK: '/private/certificate.p12' },
		{
			CSC_LINK: '/private/certificate.p12',
			CSC_KEY_PASSWORD: 'test',
			CSC_IDENTITY_AUTO_DISCOVERY: 'false',
		},
	])('rejects absent or disabled release signing: %j', (signing) => {
		expect(signingErrors({ ...signing, APPLE_KEYCHAIN_PROFILE: 'margin-notary' })).not.toEqual([])
	})

	it.each([
		{ APPLE_ID: 'owner@example.com', APPLE_KEYCHAIN_PROFILE: 'margin-notary' },
		{ APPLE_ID: ' ', APPLE_KEYCHAIN_PROFILE: 'margin-notary' },
		{ APPLE_API_KEY: '/private/key.p8', APPLE_KEYCHAIN_PROFILE: 'margin-notary' },
	])('rejects a partial scheme that shadows a complete one: %j', (notary) => {
		expect(signingErrors({ CSC_NAME: 'Owner (TEAM)', ...notary })).not.toEqual([])
	})
})
