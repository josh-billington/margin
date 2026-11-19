import { expect, test } from '@playwright/test'
import { closeApp, launch, makeDirs, removeDirs, saved } from './harness'

for (const [translation, next] of [
	['BSB', 'WEB'],
	['WEB', 'ASV'],
	['ASV', 'BSB'],
] as const) {
	test(`${translation}: add offline text, reopen, and change translation to ${next}`, async () => {
		const dirs = await makeDirs()
		let running: Awaited<ReturnType<typeof launch>> | undefined
		try {
			running = await launch(dirs)
			let { page } = running
			await page.getByRole('button', { name: 'Add verses' }).first().click()
			await page.getByLabel('Reference').fill('Genesis 1:27')
			await page.getByRole('radio', { name: translation, exact: true }).click()
			await expect(page.locator('.insert-actions .button-primary')).toBeEnabled({ timeout: 15_000 })
			await page.locator('.insert-actions .button-primary').click()
			await expect(page.locator('.passage-header')).toContainText(`Genesis 1:27 · ${translation}`)
			await expect(page.locator('.passage-text')).toContainText('male and female')
			await saved(page)
			await closeApp(running.app)
			running = await launch(dirs)
			page = running.page
			await expect(page.locator('.passage-header')).toContainText(`Genesis 1:27 · ${translation}`)
			await expect(page.locator('.passage-text')).toContainText('male and female')
			await page
				.getByRole('button', { name: `Actions for Genesis 1:27 · ${translation}`, exact: true })
				.click()
			await page.getByRole('menuitem', { name: 'Options…', exact: true }).click()
			await page.getByLabel('Change translation to').selectOption({ label: next })
			await page.getByRole('button', { name: `Change to ${next}`, exact: true }).click()
			await expect(page.locator('.passage-header')).toContainText(`Genesis 1:27 · ${next}`)
			await expect(page.locator('.passage-text')).toContainText('male and female')
			await saved(page)
		} finally {
			if (running) await closeApp(running.app)
			await removeDirs(dirs)
		}
	})
}
