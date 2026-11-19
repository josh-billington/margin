import { expect, test, type Page } from '@playwright/test'
import { addAmos, closeApp, launch, makeDirs, removeDirs } from './harness'

const sample = (page: Page, read: string, ms: number) =>
	page.evaluate(
		([read, ms]) =>
			new Promise<string[]>((resolve) => {
				const fn = new Function(`return (${read})()`) as () => string
				const out: string[] = []
				const start = performance.now()
				const tick = () => {
					out.push(Math.round(performance.now() - start) + ':' + fn())
					if (performance.now() - start < (ms as number)) requestAnimationFrame(tick)
					else resolve(out)
				}
				tick()
			}),
		[read, ms] as const,
	)

test('focus dims and undims with a fade; toolbar zoom animates', async () => {
	const dirs = await makeDirs()
	const { app, page } = await launch(dirs)
	try {
		await addAmos(page)
		await page.keyboard.press('Escape')
		const block = (await page.locator('.tl-shape[data-shape-type="passage"]').boundingBox())!
		await page.keyboard.press('t')
		await page.mouse.click(block.x + 40, block.y + block.height + 30)
		await page.waitForTimeout(100)
		await page.keyboard.type('beside')
		await page.keyboard.press('Escape')
		await expect(page.locator('.tl-shape[data-shape-type="margin-note"]')).toHaveCount(1)
		await page.keyboard.press('Escape')
		await page.locator('.passage-header').click()
		const note = `() => { const e = document.querySelector('.tl-shape[data-shape-type="margin-note"]'); const c = getComputedStyle(e); return c.display + '/' + Number(c.opacity).toFixed(2) }`
		const enterP = sample(page, note, 350)
		await page.keyboard.press('f')
		const enter = await enterP
		await page.waitForTimeout(500)
		const exitP = sample(page, note, 350)
		await page.keyboard.press('Escape')
		const exit = await exitP
		const values = (rows: string[]) =>
			rows
				.map((r) => r.split(':')[1] ?? '')
				.filter((v) => v.startsWith('block'))
				.map((v) => Number(v.split('/')[1]))
		expect(values(enter).filter((v) => v > 0.3 && v < 0.95).length, 'dim fades').toBeGreaterThan(2)
		expect(values(exit).filter((v) => v > 0.3 && v < 0.95).length, 'undim fades').toBeGreaterThan(2)
		expect(values(exit).at(-1)).toBe(1)

		await page.waitForTimeout(500)
		const zoomRead = `() => document.querySelector('.zoom-button').textContent`
		const zoomP = sample(page, zoomRead, 450)
		await page.getByRole('button', { name: 'Zoom in' }).click()
		const steps = [...new Set((await zoomP).map((r) => r.split(':')[1]))]
		expect(steps.length, 'zoom passes through intermediate values').toBeGreaterThan(3)

		// ⌘+ and ⌘− are keyboard actions: they land in one step, with no animation.
		for (const [key, from, to] of [
			['Meta+=', '100%', '150%'],
			['Meta+-', '150%', '100%'],
		] as const) {
			await page.waitForTimeout(400)
			if (key === 'Meta+=') await page.locator('.zoom-button').click()
			await expect(page.locator('.zoom-button')).toHaveText(from)
			await page.waitForTimeout(100)
			const keyP = sample(page, zoomRead, 300)
			await page.keyboard.press(key)
			expect([...new Set((await keyP).map((r) => r.split(':')[1]))], key).toEqual([from, to])
		}
	} finally {
		await closeApp(app)
		await removeDirs(dirs)
	}
})
