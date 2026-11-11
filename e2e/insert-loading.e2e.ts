import { expect, test } from '@playwright/test'
import { ipcContract } from '../src/shared/ipc/contract'
import { closeApp, launch, makeDirs, removeDirs } from './harness'

test('verse lookup uses the shared delayed spinner instead of loading copy', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			const result = await page.evaluate(() =>
				window.margin.bible.resolveReference({ reference: 'Genesis 1:1', translationId: 'kjv' }),
			)
			expect(result.ok).toBe(true)
			await app.evaluate(
				({ ipcMain }, { channel, result }) => {
					ipcMain.removeHandler(channel)
					ipcMain.handle(
						channel,
						() => new Promise((resolve) => setTimeout(() => resolve(result), 1000)),
					)
				},
				{ channel: ipcContract.bible.resolveReference.channel, result },
			)
			await page.getByRole('button', { name: 'Add verses', exact: true }).first().click()
			const dialog = page.getByRole('dialog', { name: 'Add verses', exact: true })
			const clockTime = new Date('2026-11-09T12:00:00Z')
			await page.clock.install({ time: clockTime })
			await page.clock.pauseAt(new Date(clockTime.getTime() + 1000))
			await dialog.getByRole('textbox', { name: 'Reference' }).fill('Genesis 1:1')
			const loading = dialog.getByRole('status', { name: 'Looking up verses' })
			await expect(loading).toBeAttached()
			await expect(dialog.getByText('Looking up…', { exact: true })).toHaveCount(0)
			await expect(loading.locator('svg')).toHaveCount(0)
			await page.clock.runFor(200)
			await expect(loading.locator('svg')).toBeVisible()
			const add = dialog.getByRole('button', { name: 'Add verse', exact: true })
			await expect(dialog.getByRole('button', { name: 'Add verses', exact: true })).toBeDisabled()
			await expect(add).toBeEnabled()
			await expect(loading).toHaveCount(0)
			await expect(dialog.locator('.insert-preview')).toContainText('Genesis 1:1')
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})
