import { expect, test } from '@playwright/test'
import { closeApp, launch, makeDirs, removeDirs, saved } from './harness'

test('study titles can be edited inline without a dialog', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			const sidebar = page.locator('#sidebar')
			await sidebar.getByRole('button', { name: 'New study', exact: true }).click()
			const title = sidebar.getByRole('button', { name: 'Untitled study', exact: true })
			await expect(title).toBeVisible()
			await sidebar.getByRole('button', { name: 'Rename Untitled study', exact: true }).click()
			const input = sidebar.getByRole('textbox', { name: 'New study title' })
			await expect(input).toBeFocused()
			await expect(page.getByRole('dialog', { name: 'Rename study' })).toHaveCount(0)
			await input.fill('  Amos Bible Class Series  ')
			await input.press('Enter')
			const renamed = sidebar.getByRole('button', { name: 'Amos Bible Class Series', exact: true })
			await expect(renamed).toBeFocused()
			await saved(page)
			await renamed.dblclick()
			await input.fill('Discard this')
			await input.press('Escape')
			await expect(renamed).toBeFocused()
			await renamed.press('F2')
			await expect(input).toHaveValue('Amos Bible Class Series')
			await input.fill('   ')
			await input.press('Enter')
			await expect(renamed).toBeVisible()
			await renamed.press('F2')
			await input.fill('Amos notes')
			await input.press('Tab')
			await expect(sidebar.getByRole('button', { name: 'Amos notes', exact: true })).toBeVisible()
			await saved(page)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})
