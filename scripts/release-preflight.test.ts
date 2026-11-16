import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

const script = resolve('scripts/release-preflight.mjs')
const run = (env: NodeJS.ProcessEnv) =>
	spawnSync(process.execPath, [script], { env, encoding: 'utf8' })

it('fails before packaging without signing and notarization credentials', () => {
	const result = run({})
	expect(result.status).toBe(1)
	expect(result.stderr).toContain('Developer ID Application')
	expect(result.stderr).toContain('Notarization credentials are missing')
})

it.each([
	{ APPLE_ID: 'owner@example.com', APPLE_APP_SPECIFIC_PASSWORD: 'test', APPLE_TEAM_ID: 'TEAM' },
	{ APPLE_API_KEY: '/private/key.p8', APPLE_API_KEY_ID: 'KEY', APPLE_API_ISSUER: 'ISSUER' },
	{ APPLE_KEYCHAIN_PROFILE: 'margin-notary' },
])('accepts a complete notarization scheme: %j', (notary) => {
	expect(run({ CSC_NAME: 'Owner (TEAM)', ...notary }).status).toBe(0)
	expect(
		run({ CSC_LINK: '/private/certificate.p12', CSC_KEY_PASSWORD: 'test', ...notary }).status,
	).toBe(0)
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
	expect(run({ ...signing, APPLE_KEYCHAIN_PROFILE: 'margin-notary' }).status).toBe(1)
})

it.each([
	{ APPLE_ID: 'owner@example.com', APPLE_KEYCHAIN_PROFILE: 'margin-notary' },
	{ APPLE_ID: ' ', APPLE_KEYCHAIN_PROFILE: 'margin-notary' },
	{ APPLE_API_KEY: '/private/key.p8', APPLE_KEYCHAIN_PROFILE: 'margin-notary' },
])('rejects a partial scheme that shadows a complete one: %j', (notary) => {
	expect(run({ CSC_NAME: 'Owner (TEAM)', ...notary }).status).toBe(1)
})
