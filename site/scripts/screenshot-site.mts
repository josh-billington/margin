// Full-page screenshots of the built site for review, in light and dark.
// Usage: tsx scripts/screenshot-site.mts [url] [outDir]
import { chromium } from '@playwright/test'
const url = process.argv[2] ?? 'http://127.0.0.1:4460/'
const out = process.argv[3] ?? '/tmp/margin-shots/site'
const browser = await chromium.launch({ channel: 'chrome' })
for (const colorScheme of ['light', 'dark'] as const)
	for (const [name, width, height, scale] of [
		['desktop', 1440, 900, 1],
		['mobile', 390, 844, 2],
	] as const) {
		const page = await browser.newPage({
			viewport: { width, height },
			deviceScaleFactor: scale,
			colorScheme,
		})
		for (const path of ['', 'privacy/']) {
			await page.goto(url + path, { waitUntil: 'networkidle' })
			// Trigger every entrance by scrolling through once.
			await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' })
			await page.evaluate(async () => {
				for (let y = 0; y < document.body.scrollHeight; y += 400) {
					window.scrollTo(0, y)
					await new Promise((r) => setTimeout(r, 60))
				}
				window.scrollTo(0, 0)
			})
			await page.waitForTimeout(1200)
			const tag = path ? 'privacy' : 'home'
			await page.screenshot({ path: `${out}/${colorScheme}-${tag}-${name}-fold.png` })
			await page.screenshot({
				path: `${out}/${colorScheme}-${tag}-${name}-full.png`,
				fullPage: true,
			})
		}
		await page.close()
	}
await browser.close()
