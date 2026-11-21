import { fileURLToPath } from 'node:url'
import { licenceErrors, releaseAssetErrors, signingErrors } from './release-checks'

// Every distributable needs working corpora and a licensed canvas; `--signed` adds release credentials.
const errors = [
	...(await releaseAssetErrors(fileURLToPath(new URL('../resources/', import.meta.url)))),
	...licenceErrors(process.env, fileURLToPath(new URL('../../../', import.meta.url))),
	...(process.argv.includes('--signed') ? signingErrors(process.env) : []),
]
if (errors.length) {
	console.error(`Release preflight failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
	process.exit(1)
}
