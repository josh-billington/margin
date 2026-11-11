import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { expect, it } from 'vitest'

// verify-corpus parses data/raw; with a file missing the loader would try to download it, and
// tests must not touch the network. Restore sources with `yarn import:bible` (see docs/status/bible.md).
const pins = z
	.object({ sources: z.array(z.object({ filename: z.string() })) })
	.parse(JSON.parse(readFileSync(resolve('data/sources.json'), 'utf8')))
const missing = pins.sources.filter((pin) => !existsSync(resolve('data/raw', pin.filename)))
if (missing.length)
	console.warn(
		`corpus.test skipped: ${missing.length} pinned raw source(s) absent from data/raw (e.g. ${missing[0]?.filename}). Copy data/raw or run the import to enable it.`,
	)

it.skipIf(missing.length > 0)(
	'verifies the real bundled databases, providers, reference parser, inventories, and complete mapping coverage',
	() => {
		const electron: unknown = createRequire(resolve('package.json'))('electron')
		const result = execFileSync(
			z.string().parse(electron),
			['--import', 'tsx', resolve('scripts/import-bible/verify-corpus.ts')],
			{ env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 60_000 },
		)
		expect(result).toContain('every mapping reference verified')
	},
	60_000,
)
