import { expect, test } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { addAmos, closeApp, launch, makeDirs, removeDirs, saved } from './harness'

// Runs the unsigned .app produced by `yarn dist` (skipped when it has not been built).
const executable = resolve(__dirname, '../release/mac-arm64/Margin.app/Contents/MacOS/Margin')

test.skip(!existsSync(executable), 'Run `yarn dist` first to produce release/mac-arm64/Margin.app')

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
