import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { expect, it } from 'vitest'

// Reads the generated lexicon, which a fresh checkout (CI) does not have: `pnpm import:lexicon`.
const lexicon = resolve('resources/lexicon/margin-lexicon.sqlite')

it.skipIf(!existsSync(lexicon))('reads real offline entries and spans, refusing changed study snapshots', () => {
	const electron: unknown = createRequire(resolve('package.json'))('electron')
	const output = execFileSync(
		z.string().parse(electron),
		['--import', 'tsx', resolve('scripts/import-lexicon/verify.ts')],
		{ env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 30_000 },
	)
	expect(output).toContain('snapshot safety verified')
}, 30_000)
