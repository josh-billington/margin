import process from 'node:process'
import console from 'node:console'

const env = process.env
const has = (name) => Boolean(env[name]?.trim())
const errors = []

if (!has('CSC_NAME') && !(has('CSC_LINK') && has('CSC_KEY_PASSWORD'))) {
	errors.push(
		'Set CSC_NAME to your Developer ID Application identity (without the certificate prefix), or set CSC_LINK and CSC_KEY_PASSWORD to import that certificate and its private key.',
	)
}
if (env.CSC_NAME?.trim() === '-')
	errors.push(
		'CSC_NAME must select a Developer ID Application identity; ad-hoc signing is not a release.',
	)
if (env.CSC_IDENTITY_AUTO_DISCOVERY === 'false' && !has('CSC_NAME')) {
	errors.push(
		'Unset CSC_IDENTITY_AUTO_DISCOVERY or set CSC_NAME so the Developer ID identity can be selected.',
	)
}

// Match electron-builder's credential precedence so a partial scheme cannot shadow a complete one.
const scheme =
	env.APPLE_ID || env.APPLE_APP_SPECIFIC_PASSWORD
		? ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']
		: env.APPLE_API_KEY || env.APPLE_API_KEY_ID || env.APPLE_API_ISSUER
			? ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']
			: ['APPLE_KEYCHAIN_PROFILE']
const missing = scheme.filter((name) => !has(name))
if (missing.length) {
	errors.push(
		`Notarization credentials are missing: ${missing.join(', ')}. Set one complete scheme: APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID; APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER; or APPLE_KEYCHAIN_PROFILE (optional APPLE_KEYCHAIN).`,
	)
}

if (errors.length) {
	console.error(`Release preflight failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
	process.exit(1)
}
