import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { z } from 'zod'

// postinstall builds better-sqlite3 for Electron. Use that same ABI for this explicit tool.
async function main() {
	if (!process.versions.electron) {
		const electron: unknown = createRequire(resolve('package.json'))('electron')
		const child = spawnSync(
			z.string().parse(electron),
			['--import', 'tsx', resolve('scripts/import-lexicon/index.ts')],
			{ stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
		)
		if (child.error) throw child.error
		process.exitCode = child.status ?? 1
		return
	}
	const { buildLexicon } = await import('./build')
	await buildLexicon(process.cwd())
}
void main().catch((error: unknown) => {
	console.error(error)
	process.exitCode = 1
})
