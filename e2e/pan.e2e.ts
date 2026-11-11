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

const passageX = async (page: Page) => (await page.locator('.tl-shape').first().boundingBox())!.x

test('pan: scroll, Space-drag straight after adding verses, and the Hand tool', async () => {
	const { app, page } = await launch(dirs)
	await addAmos(page)
	await page.keyboard.press('Escape')
	const canvas = (await page.locator('[aria-label="Study canvas"]').boundingBox())!
	const at = { x: canvas.x + canvas.width - 60, y: canvas.y + canvas.height - 60 }
	const drag = async () => {
		await page.mouse.move(at.x, at.y)
		await page.mouse.down()
		await page.mouse.move(at.x - 200, at.y, { steps: 8 })
		await page.mouse.up()
	}

	let x = await passageX(page)
	await page.mouse.move(at.x, at.y)
	await page.mouse.wheel(200, 0)
	await expect.poll(() => passageX(page)).toBeLessThan(x - 150)

	// Focus is on <body> after the dialog closes; Space must still pan without a click first.
	x = await passageX(page)
	await page.keyboard.down('Space')
	await drag()
	await page.keyboard.up('Space')
	await expect.poll(() => passageX(page)).toBeLessThan(x - 150)

	x = await passageX(page)
	await page.getByRole('toolbar', { name: 'Canvas tools' }).getByRole('button', { name: 'Hand' }).click()
	await drag()
	await expect.poll(() => passageX(page)).toBeLessThan(x - 150)
	await closeApp(app)
})
