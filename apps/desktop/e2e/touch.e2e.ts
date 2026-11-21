import { expect, test } from '@playwright/test'
import type { CDPSession, Locator } from '@playwright/test'
import { addAmos, center, closeApp, launch, makeDirs, removeDirs } from './harness'

/** A finger, through Chromium's own touch input: pointer events arrive with pointerType "touch". */
function finger(cdp: CDPSession) {
	const touch = (type: 'touchStart' | 'touchEnd', point?: { x: number; y: number }) =>
		cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] })
	return {
		async press(point: { x: number; y: number }, ms: number) {
			await touch('touchStart', point)
			await new Promise((resolve) => setTimeout(resolve, ms))
			await touch('touchEnd')
		},
		async tap(target: Locator | { x: number; y: number }) {
			const point = 'boundingBox' in target ? await center(target) : target
			await touch('touchStart', point)
			await touch('touchEnd')
		},
	}
}

test('iPad host: long-press Look Up, double tap note, note options, toolbar undo', async () => {
	const dirs = await makeDirs()
	const { app, page } = await launch(dirs, { MARGIN_PLATFORM: 'ipad' })
	page.on('pageerror', (error) => console.error('Renderer error:', error))
	try {
		await expect(page.locator('html')).toHaveAttribute('data-platform', 'ipad')
		// The library lives in the app's own Documents folder; there is no folder to choose.
		await expect(page.getByRole('button', { name: /Library folder/ })).toHaveCount(0)
		const cdp = await page.context().newCDPSession(page)
		await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
		const touch = finger(cdp)
		await addAmos(page)

		await touch.press(await center(page.locator('[data-word]').first()), 800)
		await touch.tap(page.getByRole('menuitem', { name: 'Look up “Thus”' }))
		await expect(page.getByRole('dialog', { name: 'Word lookup', exact: true })).toBeVisible()
		await page.keyboard.press('Escape')

		const notes = page.locator('.margin-note')
		const box = (await page.locator('[aria-label="Study canvas"]').boundingBox())!
		const empty = { x: box.x + 80, y: box.y + box.height - 140 }
		await touch.tap(empty)
		await touch.tap(empty)
		await expect(notes).toHaveCount(1)
		await expect(page.getByRole('textbox', { name: 'Note text', exact: true })).toBeFocused()
		await page.keyboard.type('Touch note')
		await page.keyboard.press('Escape')
		// A tap on the options button's own box, not its glyph, still opens the panel.
		const options = page.getByRole('button', { name: 'Note options' })
		const optionsBox = (await options.boundingBox())!
		await touch.tap({ x: optionsBox.x + 2, y: optionsBox.y + 2 })
		await expect(page.getByRole('dialog', { name: 'Note options' })).toBeVisible()
		await page.keyboard.press('Escape')
		await touch.tap(page.getByRole('button', { name: 'Undo', exact: true }))
		await expect(notes).toHaveCount(0)
	} finally {
		await closeApp(app)
		await removeDirs(dirs)
	}
})
