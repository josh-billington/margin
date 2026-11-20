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
			// Each verse that isn't next to another lands as its own block.
			await expect(page.locator('.passage-header')).toHaveCount(3)
			for (const title of ['Psalm 25:6 · KJV', 'Psalm 40:11 · KJV'])
				await expect(page.locator('.passage-header').filter({ hasText: title })).toHaveCount(1)
			await saved(page)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})

test('the translation pop-up switches both search results and the reference preview', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			await page.keyboard.press('Meta+Shift+F')
			const dialog = page.getByRole('dialog', { name: 'Add verses' })
			const field = dialog.getByRole('combobox', { name: 'Reference or words to search' })
			const translation = dialog.getByRole('combobox', { name: 'Translation' })
			await expect(translation).toHaveValue('kjv')

			await field.fill('“tender mercies”')
			await expect(dialog.getByRole('status')).toHaveText('11 verses found')
			await translation.selectOption({ label: 'WEB' })
			await expect(dialog.getByRole('status')).toHaveText('13 verses found')
			await expect(dialog.getByRole('option').first()).not.toContainText('thy tender mercies')

			// The choice carries over to a reference, and back again.
			await field.fill('John 3:16')
			await expect(dialog.locator('.insert-preview')).toContainText('World English Bible')
			await translation.selectOption({ label: 'BSB' })
			await expect(dialog.locator('.insert-preview')).toContainText('Berean Standard Bible')
			await field.fill('“tender mercies”')
			await expect(dialog.getByRole('status')).toHaveText('1 verse found')

			// JPS 1917 has no New Testament: the preview falls back to KJV and says so.
			await field.fill('John 3:16')
			await translation.selectOption({ label: 'JPS 1917' })
			await expect(dialog.locator('.insert-notice')).toContainText(
				'JPS 1917 contains only the Tanakh',
			)
			await expect(dialog.getByRole('button', { name: 'Add verses in KJV' })).toBeEnabled()
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})
