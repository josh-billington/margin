import { expect, test } from '@playwright/test'
import { closeApp, launch, makeDirs, removeDirs, saved } from './harness'

test('one dialog adds a reference, or searches and adds several matching verses', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			await saved(page)
			await page.keyboard.press('Meta+Shift+F')
			const dialog = page.getByRole('dialog', { name: 'Add verses' })
			const field = dialog.getByRole('combobox', { name: 'Reference or words to search' })
			await expect(field).toBeFocused()

			// A reference previews and adds exactly as before.
			await field.fill('Psalm 23:4')
			await expect(dialog.locator('.insert-preview')).toContainText('Psalm 23:4')
			await expect(dialog.getByRole('listbox')).not.toBeVisible()
			await field.press('Enter')
			await expect(dialog).toBeHidden()
			await expect(page.locator('.passage-header')).toHaveCount(1)

			// Anything else searches: a phrase, then ⌘-click a second result and add both.
			await page.keyboard.press('Meta+Shift+F')
			await field.fill('“tender mercies”')
			await expect(dialog.getByRole('status')).toHaveText('11 verses found')
			const options = dialog.getByRole('option')
			const first = options.filter({ hasText: /^Psalm 25:6/ })
			await expect(first.locator('mark')).toHaveText(['tender mercies'])
			await expect(first).toHaveAttribute('aria-selected', 'true')
			await options.filter({ hasText: /^Psalm 40:11/ }).click({ modifiers: ['Meta'] })
			await dialog.getByRole('button', { name: 'Add 2 verses' }).click()
			await expect(dialog).toBeHidden()
			await expect(page.locator('.passage-header')).toHaveCount(2)
			await expect(
				page.locator('.passage-header').filter({ hasText: 'Psalm 25:6, Psalm 40:11 · KJV' }),
			).toHaveCount(1)
			await saved(page)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})
