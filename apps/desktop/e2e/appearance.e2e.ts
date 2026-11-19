import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { addAmos, closeApp, launch, makeDirs, removeDirs } from './harness'
import type { Dirs } from './harness'

let dirs: Dirs
test.beforeEach(async () => {
	dirs = await makeDirs()
})
test.afterEach(async () => {
	await removeDirs(dirs)
})

const appearance = (page: Page) => page.evaluate(() => document.documentElement.dataset.appearance)
const canvasBackground = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.querySelector('.canvas-area')!).backgroundColor)
const tldrawScheme = (page: Page) =>
	page.evaluate(() => document.querySelector('.tl-container')?.getAttribute('data-color-mode'))

async function choose(page: Page, label: 'System' | 'Light' | 'Dark') {
	await page.keyboard.press('Meta+,')
	await page.getByLabel('Appearance').selectOption({ label })
	await page.keyboard.press('Escape')
}

test('appearance: setting switches data-appearance, canvas and tldraw live, and persists', async () => {
	let { app, page } = await launch(dirs)
	await expect.poll(() => appearance(page)).toMatch(/light|dark/)
	await choose(page, 'Dark')
	await expect.poll(() => appearance(page)).toBe('dark')
	expect(await canvasBackground(page)).toBe('rgb(20, 17, 21)')

	await choose(page, 'Light')
	await expect.poll(() => appearance(page)).toBe('light')
	expect(await canvasBackground(page)).toBe('rgb(247, 244, 240)')
	await expect.poll(() => tldrawScheme(page)).toBe('light')
	await addAmos(page)
	await expect(page.locator('[data-word]').first()).toBeVisible()
	const ink = await page.evaluate(() => getComputedStyle(document.body).color)
	expect(ink).toBe('rgb(28, 25, 29)')

	await closeApp(app)
	;({ app, page } = await launch(dirs))
	await expect.poll(() => appearance(page)).toBe('light')
	expect(await canvasBackground(page)).toBe('rgb(247, 244, 240)')
	await choose(page, 'Dark')
	await expect.poll(() => appearance(page)).toBe('dark')
	await expect.poll(() => tldrawScheme(page)).toBe('dark')
	await closeApp(app)
})
