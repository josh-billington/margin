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

// The welcome is switched off until the new branding (preload's welcomeIntro).
test.skip('the welcome plays once on first launch before setup, and Help › Show Welcome replays it', async () => {
	test.setTimeout(90_000)
	const dirs = await makeDirs()
	let running: Awaited<ReturnType<typeof launch>> | undefined
	try {
		running = await launch(dirs, {}, { firstRun: true, intro: true })
		let { page, app } = running
		const intro = page.getByRole('dialog', { name: 'Make scripture your own' })
		const setup = page.getByRole('dialog', { name: 'Set up Margin' })
		await expect(intro).toBeVisible()
		await expect(setup).toHaveCount(0)
		await expect(intro.getByRole('button', { name: 'Get started' })).toBeFocused({ timeout: 10_000 })
		// Escape skips it.
		await page.keyboard.press('Escape')
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
		const replay = page.getByRole('dialog', { name: 'Make scripture your own' })
		await expect(replay).toBeVisible()
		const start = replay.getByRole('button', { name: 'Get started' })
		await expect(start).toBeFocused({ timeout: 10_000 })
		await page.keyboard.press('Enter')
		// Get started dissolves it into the study.
		await expect(replay).toHaveCount(0, { timeout: 15_000 })
		expect(await stylesheets(page)).toEqual(afterIntro)
	} finally {
		if (running) await closeApp(running.app)
		await removeDirs(dirs)
	}
})
