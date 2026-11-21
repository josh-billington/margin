import { expect, test } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { addAmos, closeApp, launch, makeDirs, removeDirs, saved } from './harness'

// Public builds turn enableNodeCliInspectArguments off. `pnpm dist:test` builds a separate ad-hoc .app
// with it on so Playwright can attach with --inspect=0 (skipped when it has not been built).
// MARGIN_PACKAGED_APP points it at another build, such as the Intel one (`pnpm dist:test --x64`,
// release/test/mac/Margin.app), which Rosetta runs on Apple silicon.
const executable = resolve(
	__dirname,
	'..',
	process.env.MARGIN_PACKAGED_APP ?? 'release/test/mac-arm64/Margin.app',
	'Contents/MacOS/Margin',
)

test.skip(
	!existsSync(executable),
	'Run `pnpm dist:test` first to produce release/test/mac-arm64/Margin.app',
)

test('packaged app: scripture loads offline, native glass, no network requests', async () => {
	const dirs = await makeDirs()
	try {
		// Any attempt to reach the network fails fast: all traffic is pointed at a dead local proxy.
		const { app, page } = await launch(
			dirs,
			{ MARGIN_GLASS: '' },
			{ executablePath: executable, args: ['--proxy-server=http://127.0.0.1:9'] },
		)
		const stderr: string[] = []
		app.process().stderr?.on('data', (chunk: Buffer) => stderr.push(String(chunk)))
		await app.evaluate(({ session }) => {
			const seen: string[] = []
			;(globalThis as { __netLog?: string[] }).__netLog = seen
			session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
				if (/^(https?|wss?|ftp):/.test(details.url)) seen.push(details.url)
				callback({})
			})
		})
		expect(await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)).toBe(true)

		await addAmos(page)
		await expect(page.locator('[data-word]').first()).toHaveText('Thus')
		await saved(page)
		const entry = await page.evaluate(() => window.margin.lexicon.getEntry({ id: 'H01254' }))
		expect(entry.ok && entry.data?.id).toBe('H1254')
		expect(entry.ok && entry.data?.definition).toContain('create')
		const search = await page.evaluate(() =>
			window.margin.bible.search({
				query: '"valley of the shadow of death"',
				translation: { kind: 'edition', id: 'kjv' },
				scope: { kind: 'all' },
			}),
		)
		expect(search.ok && search.data.hits[0]?.ref).toEqual({
			book: 'PSA',
			chapter: 23,
			verse: 4,
		})
		const bdb = await page.evaluate(() => window.margin.lexicon.getBdbEntries({ id: 'H1254' }))
		expect(bdb.ok && bdb.data.map(({ gloss }) => gloss)).toEqual(['shape', 'be fat'])
		await expect(page.locator('html')).toHaveAttribute('data-glass', 'native')
		// An unlicensed production tldraw blanks the canvas ~5 s after mount; licensed, the passage stays.
		await page.waitForTimeout(6500)
		await expect(page.locator('.tl-container')).toBeVisible()
		await expect(page.locator('[data-word]').first()).toHaveText('Thus')

		// Fonts come from the bundle, not the network.
		const fonts = await page.evaluate(async () => {
			await document.fonts.ready
			return [...document.fonts]
				.filter((font) => font.status === 'loaded')
				.map((font) => font.family)
		})
		expect(fonts.length).toBeGreaterThan(0)

		const requests = await app.evaluate(
			() => (globalThis as { __netLog?: string[] }).__netLog ?? [],
		)
		expect(requests).toEqual([])
		expect(stderr.join('')).not.toContain('Liquid Glass failed')
		await closeApp(app)
	} finally {
		await removeDirs(dirs)
	}
})
