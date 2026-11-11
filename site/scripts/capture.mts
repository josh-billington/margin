/**
 * Composes the demo study in the real app and saves raw 2x screenshots for the site.
 * Run from the repo root after `npx electron-vite build`:
 *   unset ELECTRON_RUN_AS_NODE && node_modules/.bin/tsx site/scripts/capture.mts
 * Uses throwaway data dirs (never ~/Documents/Margin), MARGIN_GLASS=0, and serves out/renderer
 * over http like e2e/harness.ts. Captures each appearance in $APPEARANCES (default "dark,light"),
 * set through the prefs IPC, into $SHOTS_DIR/<appearance> (default /tmp/margin-shots/raw/dark, …/light).
 * Then run `python3 site/scripts/crop.py` to export the site's webp crops.
 */
import { _electron as electron, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
const repo = resolve(process.env.CAPTURE_REPO ?? resolve(import.meta.dirname, '../..'))
const MIME: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.wasm': 'application/wasm',
}
const root = join(repo, 'out/renderer')
const server = createServer((q, r) => {
	const p = decodeURIComponent((q.url ?? '/').split('?')[0])
	readFile(join(root, p === '/' ? 'index.html' : p))
		.then((b) => {
			r.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'text/html' })
			r.end(b)
		})
		.catch(() => {
			r.writeHead(404)
			r.end()
		})
})
await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()))
const address = server.address()
if (!address || typeof address === 'string') throw new Error('Capture server did not bind a port')
const url = `http://127.0.0.1:${address.port}/`
async function capture(appearance: string) {
	const tmp = await mkdtemp(join(tmpdir(), 'margin-shots-'))
	const env: Record<string, string> = {}
	for (const [k, v] of Object.entries(process.env))
		if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') env[k] = v
	const app = await electron.launch({
		args: [repo],
		env: {
			...env,
			MARGIN_USER_DATA_DIR: join(tmp, 'userData'),
			MARGIN_LIBRARY_DIR: join(tmp, 'library'),
			MARGIN_GLASS: '0',
			ELECTRON_RENDERER_URL: url,
		},
	})
	const page = await app.firstWindow()
	page.setDefaultTimeout(15_000)
	try {
		await page.waitForSelector('[aria-label="Study canvas"]')
		await page.evaluate(
			(mode) => (window as any).margin.prefs.set({ appearance: mode }),
			appearance,
		)
		await page.waitForFunction(
			(mode) => document.documentElement.dataset.appearance === mode,
			appearance,
		)
		await app.evaluate(({ BrowserWindow }) => {
			const w = BrowserWindow.getAllWindows()[0]
			w.setContentSize(1440, 900)
			w.center()
		})
		await page.waitForTimeout(500)
		console.log('dpr', await page.evaluate(() => devicePixelRatio))
		const OUT = join(process.env.SHOTS_DIR ?? '/tmp/margin-shots/raw', appearance)
		await mkdir(OUT, { recursive: true })
		const shot = (name: string) => page.screenshot({ path: `${OUT}/${name}.png` })

		// Title
		await page.getByRole('button', { name: 'Rename Untitled study', exact: true }).click()
		const title = page.getByRole('textbox', { name: 'New study title' })
		await title.fill('They that trust in the LORD')
		await title.press('Enter')

		// Verses
		await page.getByRole('button', { name: 'Add verses' }).first().click()
		await page.getByLabel('Reference').fill('KJV Psalm 125:1')
		await expect(
			page
				.getByRole('dialog', { name: 'Add verses' })
				.getByRole('button', { name: 'Add verse', exact: true }),
		).toBeEnabled()
		await page.keyboard.press('Enter')
		await page.waitForSelector('[data-word]')
		await page.waitForTimeout(600)
		await page.keyboard.press('Escape')

		/** Selects one word's text, the way a reader would before pressing a shortcut. */
		async function selectWord(i: number, last = i) {
			await page.locator('.passage-text').first().focus()
			await page.evaluate(
				({ first, last }) => {
					const words = document.querySelectorAll('[data-word]')
					window
						.getSelection()
						?.setBaseAndExtent(words[first], 0, words[last], words[last].childNodes.length)
				},
				{ first: i, last },
			)
			await page.waitForTimeout(100)
		}
		async function tag(i: number, name: string, color: string, last = i) {
			await page.keyboard.press('Escape')
			await selectWord(i, last)
			await page.keyboard.press('Meta+Shift+H')
			const dialog = page.getByRole('dialog', { name: 'Tag selected words' })
			await dialog.waitFor()
			const existing = dialog.getByRole('button', { name: new RegExp('^' + name) })
			if (await existing.count()) await existing.first().click()
			else {
				const reveal = dialog.getByRole('button', { name: 'New tag' })
				if (await reveal.count()) await reveal.click()
				await dialog.getByPlaceholder('Name').fill(name)
				await dialog.getByRole('button', { name: color, exact: true }).click()
				await dialog.getByRole('button', { name: 'Create and apply' }).click()
			}
			await page.waitForTimeout(250)
			await page.keyboard.press('Escape')
		}
		await tag(2, 'Trust', 'Sky')
		await tag(9, 'Zion', 'Amber', 10)
		await tag(12, 'Steadfast', 'Violet', 14)
		await tag(16, 'Steadfast', 'Violet', 18)
		await shot('step-tags')
		if (process.env.CAPTURE_BDB === '1') {
			await page.keyboard.press('Escape')
			await page.locator('.passage-header').click({ position: { x: 80, y: 10 } })
			const edge = page.getByRole('separator', { name: 'Resize right edge' })
			await edge.focus()
			for (let step = 0; step < 28; step++) await edge.press('ArrowRight')
			await page.mouse.click(1380, 120)
			await page.mouse.click(1380, 120)
			await page.keyboard.press('Meta+0')
			await page.waitForTimeout(600)
			await page
				.getByRole('toolbar', { name: 'Canvas tools' })
				.getByRole('button', { name: 'Hand', exact: true })
				.click()
			await expect(page.getByRole('separator', { name: 'Resize left edge' })).toHaveCount(0)
			await selectWord(2)
			await page.keyboard.press('Control+Meta+d')
			const lookup = page.getByRole('dialog', { name: 'Word lookup', exact: true })
			await lookup.locator('.lookup-id').waitFor()
			await lookup.locator('.lookup-dictionaries button').filter({ hasText: /^BDB$/ }).click()
			await lookup.locator('.lookup-bdb-section').first().waitFor()
			await page.mouse.move(1380, 120)
			await page.waitForTimeout(600)
			console.log(appearance, 'lookup bounds', {
				block: await page.locator('.passage-block').boundingBox(),
				popover: await lookup.boundingBox(),
			})
			await shot('lookup')
			return
		}

		// Select a word and press T: the note lands beside the verses, already arrowed to the word.
		async function note(i: number, text: string) {
			await page.keyboard.press('Escape')
			await page.keyboard.press('Escape')
			await selectWord(i)
			await page
				.getByRole('toolbar', { name: 'Canvas tools' })
				.getByRole('button', { name: 'Note', exact: true })
				.click()
			const input = page.getByLabel('Note text')
			await expect(input).toBeFocused()
			await page.keyboard.type(text, { delay: 5 })
			await page.keyboard.press('Escape')
			await page.waitForTimeout(250)
		}
		const NOTES = JSON.parse(
			process.env.NOTES ??
				JSON.stringify([
					[2, 'leaning your whole weight'],
					[9, 'the hills around Jerusalem (v. 2)'],
					[16, 'stays, as the mountain stays'],
				]),
		) as [number, string][]
		for (const [i, t] of NOTES) await note(i, t)
		// Then move them into the margins around the verses, as a reader would; the arrows follow.
		const PLACES = JSON.parse(
			process.env.PLACES ??
				JSON.stringify([
					[200, -30],
					[520, -200],
					[260, 70],
				]),
		) as [number, number][]
		await page.keyboard.press('Escape')
		await page.keyboard.press('v')
		for (const [i, [, text]] of NOTES.entries()) {
			const verses = (await page.locator('.passage-block').first().boundingBox())!
			const from = (await page.locator('.margin-note').filter({ hasText: text }).boundingBox())!
			const [dx, dy] = PLACES[i]
			const to = {
				x: verses.x + dx + from.width / 2,
				y: (dy < 0 ? verses.y + dy : verses.y + verses.height + dy) + from.height / 2,
			}
			await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
			await page.mouse.down()
			await page.mouse.move(to.x, to.y, { steps: 12 })
			await page.mouse.up()
			await page.keyboard.press('Escape')
		}
		await page.waitForTimeout(300)
		await page.keyboard.press('Escape')
		await page.keyboard.press('v')
		await page.keyboard.press('Escape')
		await page.mouse.click(1380, 120)
		await page.waitForTimeout(500)
		await shot('study')

		await page.keyboard.press('Meta+k')
		await page.waitForTimeout(500)
		await shot('palette')
		await page.keyboard.press('Escape')
		await page.waitForTimeout(300)
		await page.getByRole('button', { name: 'Add verses' }).first().click()
		await page.getByLabel('Reference').fill('Psalm 23')
		await page.waitForTimeout(700)
		await page.getByRole('radio', { name: /JPS/ }).click()
		await page.waitForTimeout(300)
		console.log(
			appearance,
			'jps',
			await page.getByRole('radio', { name: /JPS/ }).getAttribute('aria-checked'),
		)
		await page.waitForTimeout(500)
		await shot('add-verses')
		await page
			.getByRole('button', { name: /^Add (chapter|verses)$/ })
			.last()
			.click()
		await page.waitForTimeout(1200)
		// Which translation landed: JPS 1917 opens Psalm 23 with "A Psalm of David.", the KJV does not.
		console.log(
			appearance,
			'psalm 23 v1:',
			await page.evaluate(() => {
				const t = document.body.innerText
				const i = t.indexOf('shepherd')
				return t.slice(Math.max(0, i - 60), i + 20).replace(/\s+/g, ' ')
			}),
		)
		await page.keyboard.press('Escape')
		await page.mouse.click(1380, 120)
		await page.waitForTimeout(400)
		await shot('two-passages')
		await page.keyboard.press('Meta+0')
		await page.waitForTimeout(900)
		await shot('overview')
		await page.getByRole('button', { name: /^Focus Psalms 125/ }).click()
		await page.waitForTimeout(600)
		await page.locator('.verse-number-focusable').first().click()
		await page.waitForTimeout(600)
		await page.mouse.click(1380, 120)
		await page.keyboard.press('Meta+0')
		await page.waitForTimeout(900)
		await expect
			.poll(() =>
				page
					.locator('.passage-block')
					.nth(1)
					.evaluate((element) => {
						const shape = element.closest('.tl-shape')
						return shape ? Number(getComputedStyle(shape).opacity) : 1
					}),
			)
			.toBeLessThan(0.3)
		await shot('focus-verse')
		await page.keyboard.press('Escape')
		await page.keyboard.press('Escape')
		await page
			.getByLabel('Library')
			.getByText(/Psalms 23/)
			.click()
		await page.waitForTimeout(300)
		await page.keyboard.press('f')
		await page.waitForTimeout(1300)
		await shot('focus')
	} catch (error) {
		await page.screenshot({ path: `/tmp/margin-shots/error-${appearance}.png` })
		console.error(await page.locator('.margin-note').allTextContents())
		throw error
	} finally {
		await app.close()
	}
}

try {
	for (const appearance of (process.env.APPEARANCES ?? 'dark,light').split(','))
		await capture(appearance)
} finally {
	server.close()
}
