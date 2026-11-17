import { expect, test } from '@playwright/test'
import { access, writeFile, rm, mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { closeApp, launch, makeDirs, removeDirs, saved, studyFiles } from './harness'

test('first launch sets the translation and never shows setup again', async () => {
	const dirs = await makeDirs()
	let running: Awaited<ReturnType<typeof launch>> | undefined
	try {
		running = await launch(dirs, {}, { firstRun: true })
		let { page } = running
		const setup = page.getByRole('dialog', { name: 'Set up Margin' })
		await expect(setup).toBeVisible()
		await expect(setup).toBeFocused()
		await expect(setup.locator('.setup-folder')).toHaveAttribute('title', dirs.library)
		await expect(setup.getByLabel('Default translation').locator('option')).toHaveText([
			'Berean Standard Bible',
			'World English Bible',
			'American Standard Version (1901)',
			'King James Version',
		])
		await page.keyboard.press('Tab')
		await expect(setup.getByRole('button', { name: 'Choose a folder…' })).toBeFocused()
		await page.keyboard.press('Tab')
		await expect(setup.getByLabel('Default translation')).toBeFocused()
		await page.keyboard.press('Enter')
		await expect(setup.getByRole('button', { name: 'Start studying' })).toBeEnabled()
		const library = await page.evaluate(() => window.margin.library.getLibrary())
		expect(library.ok && library.data?.setup).toBe('pending')
		await page.keyboard.press('Tab')
		await expect(setup.getByRole('button', { name: 'Start studying' })).toBeFocused()
		await expect(access(dirs.library)).rejects.toThrow()
		expect(await studyFiles(dirs)).toEqual([])
		await setup.getByLabel('Default translation').selectOption('bsb')
		// One choice at setup covers the Old Testament too.
		await expect
			.poll(async () => {
				const prefs = await page.evaluate(() => window.margin.prefs.get())
				return prefs.ok && [prefs.data.defaultTranslation, prefs.data.oldTestamentTranslation]
			})
			.toEqual(['bsb', 'bsb'])
		await setup.getByRole('button', { name: 'Start studying' }).click()
		await expect(setup).toBeHidden()
		await expect.poll(async () => (await studyFiles(dirs)).length).toBe(1)
		await page.getByRole('button', { name: 'Add verses' }).first().click()
		await expect(page.getByRole('radio', { name: 'BSB', exact: true })).toBeChecked()
		await page.getByLabel('Reference').fill('John 3:16')
		await expect(page.locator('.insert-actions .button-primary')).toBeEnabled({ timeout: 15_000 })
		await page.locator('.insert-actions .button-primary').click()
		await expect(page.locator('.passage-header')).toContainText('John 3:16 · BSB')
		await saved(page)
		await closeApp(running.app)
		running = await launch(dirs, {}, { firstRun: true })
		page = running.page
		await expect(page.locator('.passage-header')).toContainText('John 3:16 · BSB')
		await expect(page.getByRole('dialog', { name: 'Set up Margin' })).toHaveCount(0)
	} finally {
		if (running) await closeApp(running.app)
		await removeDirs(dirs)
	}
})

for (const key of ['Enter', 'Escape']) {
	test(`${key} completes setup with the defaults`, async () => {
		const dirs = await makeDirs()
		let running: Awaited<ReturnType<typeof launch>> | undefined
		try {
			running = await launch(dirs, {}, { firstRun: true })
			const { page } = running
			await expect(page.getByRole('dialog', { name: 'Set up Margin' })).toBeVisible()
			await page.keyboard.press(key)
			await expect(page.getByRole('dialog', { name: 'Set up Margin' })).toHaveCount(0)
			await expect.poll(async () => (await studyFiles(dirs)).length).toBe(1)
			const prefs = await page.evaluate(() => window.margin.prefs.get())
			expect(prefs.ok && prefs.data.defaultTranslation).toBe('kjv')
			await closeApp(running.app)
			running = await launch(dirs, {}, { firstRun: true })
			await expect(running.page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
			await expect(running.page.getByRole('dialog', { name: 'Set up Margin' })).toHaveCount(0)
		} finally {
			if (running) await closeApp(running.app)
			await removeDirs(dirs)
		}
	})
}

test('an unavailable library still opens a window and can be retried from setup', async () => {
	const dirs = await makeDirs()
	let running: Awaited<ReturnType<typeof launch>> | undefined
	try {
		await writeFile(dirs.library, 'unavailable')
		running = await launch(dirs)
		const setup = running.page.getByRole('dialog', { name: 'Set up Margin' })
		await expect(setup).toBeVisible()
		await expect(
			running.page.getByText('Margin couldn’t open your library.', { exact: false }),
		).toBeVisible()
		await rm(dirs.library)
		await setup.getByRole('button', { name: 'Start studying' }).click()
		await expect(setup).toBeHidden()
		await expect.poll(async () => (await studyFiles(dirs)).length).toBe(1)
	} finally {
		if (running) await closeApp(running.app)
		await removeDirs(dirs)
	}
})

test('malformed preferences are kept aside while setup remains usable', async () => {
	const dirs = await makeDirs()
	let running: Awaited<ReturnType<typeof launch>> | undefined
	try {
		await mkdir(dirs.userData, { recursive: true })
		await writeFile(join(dirs.userData, 'prefs.json'), '{broken')
		running = await launch(dirs, {}, { firstRun: true })
		const setup = running.page.getByRole('dialog', { name: 'Set up Margin' })
		await expect(setup).toBeVisible()
		const backup = (await readdir(dirs.userData)).find((name) => name.startsWith('prefs.json.bad-'))
		expect(backup).toBeDefined()
		expect(await readFile(join(dirs.userData, backup!), 'utf8')).toBe('{broken')
		await setup.getByRole('button', { name: 'Start studying' }).click()
		await expect(setup).toBeHidden()
		await expect.poll(async () => (await studyFiles(dirs)).length).toBe(1)
	} finally {
		if (running) await closeApp(running.app)
		await removeDirs(dirs)
	}
})
