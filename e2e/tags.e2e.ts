import { expect, test } from '@playwright/test'
import {
	addAmos,
	center,
	closeApp,
	createTagFromPopover,
	firstStudyFile,
	launch,
	makeDirs,
	readStudy,
	records,
	removeDirs,
	saved,
	selectWords,
	wordAt,
} from './harness'

test('tag sidebar: create, rename, recolor, delete with reassign', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		await addAmos(page)
		await selectWords(page, 1)
		await page.keyboard.press('Meta+Shift+H')
		await createTagFromPopover(page, 'Judgment')
		await expect(page.locator('[data-word][data-tag-name="Judgment"]').first()).toBeVisible()

		const sidebar = page.locator('#sidebar')
		await sidebar.getByRole('button', { name: 'New tag' }).click()
		const create = page.getByRole('dialog', { name: 'New tag' })
		await create.getByRole('textbox').fill('Mercy')
		await create.getByRole('button', { name: /^(Create|Add)/ }).click()
		await expect(sidebar.getByRole('button', { name: /^Mercy, 0 highlights/ })).toBeVisible()

		// The New tag popover is still open here; opening Edit tag must not blank the canvas.
		// Rename and recolor.
		await sidebar.getByRole('button', { name: 'Edit tag Judgment' }).click()
		const edit = page.getByRole('dialog', { name: 'Edit tag Judgment' })
		await expect(page.locator('.passage-block').first()).toBeVisible()
		await edit.getByRole('textbox').fill('Wrath')
		await edit.getByRole('textbox').press('Enter')
		await expect(page.locator('[data-word][data-tag-name="Wrath"]').first()).toBeVisible()
		const word = page.locator('[data-word][data-tag-name="Wrath"]').first()
		const before = await word.evaluate((el) => (el as HTMLElement).style.color)
		await page
			.getByRole('dialog', { name: 'Edit tag Wrath' })
			.getByRole('button', { name: 'Rose' })
			.click()
		await expect.poll(() => word.evaluate((el) => (el as HTMLElement).style.color)).not.toBe(before)
		await expect(word).toHaveCSS('color', /.+/)
		expect(await word.evaluate((el) => (el as HTMLElement).style.color)).toBe('var(--rose)')

		// Delete with reassign.
		await page
			.getByRole('dialog', { name: 'Edit tag Wrath' })
			.getByRole('button', { name: /^Delete tag/ })
			.click()
		const confirm = page.getByRole('alertdialog')
		await confirm.getByLabel('Reassign to').selectOption({ label: 'Mercy' })
		await confirm.getByRole('button', { name: 'Delete tag' }).click()
		await expect(page.locator('[data-word][data-tag-name="Wrath"]')).toHaveCount(0)
		await expect(page.locator('[data-word][data-tag-name="Mercy"]').first()).toBeVisible()
		await expect(sidebar.getByRole('button', { name: /^Mercy, [1-9]/ })).toBeVisible()
		await closeApp(app)
	} finally {
		await removeDirs(dirs)
	}
})

test('Highlight mode applies a plain highlight at once; a click recolours it', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		await addAmos(page)
		await page.keyboard.press('Escape')
		await page.keyboard.press('h')
		const from = await center(wordAt(page, 0))
		const to = await center(wordAt(page, 2))
		await page.mouse.move(from.x, from.y)
		await page.mouse.down()
		await page.mouse.move(to.x, to.y, { steps: 8 })
		await page.mouse.up()
		// No popover and no tag: the words are simply highlighted.
		await expect(page.locator('[data-word][data-tag-name="Highlight"]')).toHaveCount(3)
		await expect(page.getByRole('dialog')).toHaveCount(0)
		await expect(wordAt(page, 0)).toHaveCSS('color', /.+/)
		expect(await wordAt(page, 0).evaluate((el) => (el as HTMLElement).style.color)).toBe(
			'var(--amber)',
		)
		await saved(page)

		const file = await firstStudyFile(dirs)
		const passage = () =>
			readStudy(file).then((study) =>
				records(study).find((r) => r.typeName === 'shape' && r.type === 'passage'),
			)
		await expect.poll(async () => (await passage())?.props.highlights[0]?.color).toBe('amber')
		expect((await passage()).props.highlights[0].tagId).toBeUndefined()

		// Clicking the highlight opens the small popover; a swatch recolours it.
		await page.mouse.click(from.x, from.y)
		const dialog = page.getByRole('dialog', { name: 'Highlight' })
		await dialog.getByRole('button', { name: 'Rose' }).click()
		await expect
			.poll(() => wordAt(page, 1).evaluate((el) => (el as HTMLElement).style.color))
			.toBe('var(--rose)')
		await expect(page.locator('[data-word][data-tag-name="Highlight"]')).toHaveCount(3)
		await expect.poll(async () => (await passage())?.props.highlights[0]?.color).toBe('rose')
		await closeApp(app)
	} finally {
		await removeDirs(dirs)
	}
})
