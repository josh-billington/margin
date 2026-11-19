import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { closeApp, launch, makeDirs, removeDirs } from './harness'

/** Every stylesheet in the document, by source and rule text (React's generated ids aside). */
const stylesheets = (page: Page) =>
	page.evaluate(() =>
		[...document.styleSheets].map((sheet) => ({
			source: sheet.href ?? 'inline',
			rules: [...sheet.cssRules].map((rule) => rule.cssText.replace(/_r_\w+_/g, '_r_')).join('\n'),
		})),
	)

test('the welcome plays once on first launch before setup, and Help › Show Welcome replays it', async () => {
	test.setTimeout(90_000)
	const dirs = await makeDirs()
	let running: Awaited<ReturnType<typeof launch>> | undefined
	try {
		running = await launch(dirs, {}, { firstRun: true, intro: true })
		let { page, app } = running
		const intro = page.getByRole('dialog', { name: 'Welcome to Margin' })
		const setup = page.getByRole('dialog', { name: 'Set up Margin' })
		await expect(intro).toBeVisible()
		await expect(setup).toHaveCount(0)
		await expect(intro.getByRole('button', { name: 'Continue' })).toBeEnabled({ timeout: 10_000 })
		await expect(intro).toHaveAccessibleDescription(/Study with a pen in hand\./)
		await intro.getByRole('button', { name: 'Skip' }).click()
		await expect(intro).toHaveCount(0)
		await expect(setup).toBeVisible()
		await expect(setup).toBeFocused()
		const prefs = await page.evaluate(() => window.margin.prefs.get())
		expect(prefs.ok && prefs.data.introSeen).toBe(true)
		await setup.getByRole('button', { name: 'Start studying' }).click()
		await expect(setup).toBeHidden()
		// The intro's styles leave with it: the document matches a launch that never showed it.
		const afterIntro = await stylesheets(page)
		await closeApp(app)

		running = await launch(dirs, {}, { firstRun: true, intro: true })
		;({ page, app } = running)
		await expect(page.locator('.passage-block, .empty-hint').first()).toBeVisible()
		await expect(page.getByRole('dialog')).toHaveCount(0)
		expect(await stylesheets(page)).toEqual(afterIntro)

		await app.evaluate(({ Menu }) =>
			Menu.getApplicationMenu()?.getMenuItemById('intro.show')?.click(),
		)
		const replay = page.getByRole('dialog', { name: 'Welcome to Margin' })
		await expect(replay).toBeVisible()
		const next = replay.getByRole('button', { name: 'Continue' })
		await expect(next).toBeEnabled({ timeout: 10_000 })
		await expect(next).toBeFocused()
		for (const title of [
			'Mark what you see.',
			'Connect the verses.',
			'Keep your thoughts beside the text.',
		]) {
			await page.keyboard.press('Enter')
			await expect(replay).toHaveAccessibleDescription(new RegExp(title.replace('.', '\\.')))
		}
		await expect(replay.locator('[data-intro-word="word"]')).toBeAttached()
		await page.keyboard.press('Enter')
		// The ending plays by itself and dissolves into the study.
		await expect(replay).toHaveCount(0, { timeout: 15_000 })
		expect(await stylesheets(page)).toEqual(afterIntro)
	} finally {
		if (running) await closeApp(running.app)
		await removeDirs(dirs)
	}
})
