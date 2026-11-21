import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { migrateStudy } from '@margin/contract/study/migrations'
import {
	addAmos,
	center,
	closeApp,
	firstStudyFile,
	launch,
	makeDirs,
	removeDirs,
	wordAt,
} from './harness'

test('draws on Mac and saves ink, a rectangle and a text label with undoable colour', async () => {
	const dirs = await makeDirs()
	let { app, page } = await launch(dirs, { MARGIN_PLATFORM: 'mac' })
	try {
		await addAmos(page)
		const toolbar = page.getByRole('toolbar', { name: 'Canvas tools' })
		const shapes = toolbar.getByRole('button', { name: 'Shapes' })
		const chooser = page.getByRole('dialog', { name: 'Shapes' })
		const rectangle = page.locator('[data-shape-type="geo"] svg path').first()
		const readSavedStudy = async () =>
			migrateStudy(JSON.parse(await readFile(await firstStudyFile(dirs), 'utf8')))
		const savedVersion = async () => (await readSavedStudy()).schemaVersion
		const from = await center(wordAt(page, 1))
		const to = await center(wordAt(page, 8))
		await page.keyboard.press('d')
		await expect(toolbar.getByRole('button', { name: 'Draw' })).toHaveAttribute(
			'aria-pressed',
			'true',
		)
		await page.mouse.move(from.x, from.y)
		await page.mouse.down()
		await page.mouse.move((from.x + to.x) / 2, from.y - 68, { steps: 10 })
		await page.mouse.move(to.x, to.y, { steps: 10 })
		await page.mouse.up()
		await expect(page.locator('[data-margin-ink="arrow"] polygon')).toHaveCount(1)
		await expect.poll(savedVersion).toBe(2)

		await shapes.click()
		await chooser.getByRole('button', { name: 'Rectangle' }).click()
		await page.mouse.move(from.x, from.y + 105)
		await page.mouse.down()
		await page.mouse.move(from.x + 150, from.y + 175, { steps: 12 })
		await page.mouse.up()
		await expect(rectangle).toBeVisible()
		const ink = await rectangle.getAttribute('stroke')
		await shapes.click()
		await expect(chooser.getByRole('button', { name: 'Ink' })).toHaveAttribute(
			'aria-pressed',
			'true',
		)
		await chooser.getByRole('button', { name: 'Violet' }).click()
		await expect(rectangle).not.toHaveAttribute('stroke', ink ?? '')
		await page.keyboard.press('Escape')
		await expect(chooser).toBeHidden()
		await page.keyboard.press('Meta+z')
		await expect(rectangle).toHaveAttribute('stroke', ink ?? '')

		await page.keyboard.press('y')
		await page.mouse.click(from.x + 16, from.y + 137)
		const text = page.locator('[data-shape-type="text"] [contenteditable="true"]')
		await expect(text).toBeFocused()
		await page.keyboard.type('Cause and effect')
		await page.keyboard.press('Escape')
		const label = page
			.locator('[data-shape-type="text"] .tl-text-content')
			.getByText('Cause and effect')
		await expect(label).toBeVisible()
		await expect.poll(savedVersion).toBe(3)
		await closeApp(app)
		;({ app, page } = await launch(dirs))
		await expect(
			page.locator('[data-shape-type="text"] .tl-text-content').getByText('Cause and effect'),
		).toBeVisible()
		await expect(page.locator('[data-shape-type="geo"]')).toHaveCount(1)
		await expect(page.locator('[data-margin-ink="arrow"] polygon')).toHaveCount(1)
	} finally {
		await closeApp(app)
		await removeDirs(dirs)
	}
})
