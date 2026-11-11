import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import {
	addAmos,
	closeApp,
	launch,
	makeDirs,
	readStudy,
	records,
	removeDirs,
	saved,
	selectWords,
	firstStudyFile,
	studyFiles,
} from './harness'
import type { Dirs } from './harness'

let dirs: Dirs
test.beforeEach(async () => {
	dirs = await makeDirs()
})
test.afterEach(async () => {
	await chmod(join(dirs.library, 'studies'), 0o755).catch(() => undefined)
	await removeDirs(dirs)
})

const tool = (page: Page, name: string) =>
	page.getByRole('toolbar', { name: 'Canvas tools' }).getByRole('button', { name, exact: true })

test('launch: empty library creates "Untitled study"; relaunch reopens it', async () => {
	let { app, page } = await launch(dirs)
	await expect(page.getByLabel('Study title')).toHaveValue('Untitled study')
	await expect(page.getByLabel('Library').getByText('Untitled study')).toBeVisible()
	await expect(page.getByRole('main', { name: 'Study canvas' })).toBeVisible()
	await saved(page)
	expect(await studyFiles(dirs)).toHaveLength(1)
	await closeApp(app)
	;({ app, page } = await launch(dirs))
	await expect(page.getByLabel('Library').getByText('Untitled study')).toHaveCount(1)
	expect(await studyFiles(dirs)).toHaveLength(1)
	await closeApp(app)
})

test('keyboard: tool shortcuts, palette, sidebar, focus mode, word selection', async () => {
	const { app, page } = await launch(dirs)
	await addAmos(page)
	await page.keyboard.press('Escape')
	await page.locator('[aria-label="Study canvas"]').click({ position: { x: 20, y: 20 } })

	for (const [key, name] of [
		['t', 'Note'],
		['a', 'Arrow'],
		['h', 'Highlight'],
		['v', 'Select'],
	] as const) {
		await page.keyboard.press(key)
		await expect(tool(page, name)).toHaveAttribute('aria-pressed', 'true')
	}

	await page.keyboard.press('Meta+k')
	await expect(
		page.getByRole('dialog').getByRole('combobox').or(page.locator('[cmdk-input]')),
	).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(page.locator('[cmdk-input]')).toHaveCount(0)

	const sidebar = page.locator('#sidebar')
	await expect(sidebar).toBeVisible()
	await page.keyboard.press('Meta+\\')
	await expect(sidebar).toBeHidden()
	await page.keyboard.press('Meta+\\')
	await expect(sidebar).toBeVisible()

	// Select the passage, F enters reading focus, Esc leaves it.
	await page.locator('.passage-header').click()
	const zoom = page.getByRole('button', { name: 'Reset zoom to 100%' })
	// The sidebar toggle resizes the canvas and inserting a passage animates the camera; wait for
	// both to settle before taking the baseline (a zoom animation started while the viewport is
	// still resizing ends at the wrong zoom).
	const readState = async () =>
		`${await zoom.textContent()}|${await page.locator('.tl-container').evaluate((el) => el.getBoundingClientRect().width)}`
	let before = ''
	await expect
		.poll(async () => {
			const now = await readState()
			const settled = now === before
			before = now
			await page.waitForTimeout(150)
			return settled
		})
		.toBe(true)
	const baseline = await zoom.textContent()
	await page.locator('.passage-header').click()
	await page.keyboard.press('f')
	await expect(zoom).not.toHaveText(baseline!)
	await page.keyboard.press('Escape')
	await expect(zoom).toHaveText(baseline!)

	// Keyboard word selection: Right moves, Shift+Right extends.
	await selectWords(page, 0)
	const selected = () => page.evaluate(() => String(getSelection()).trim())
	const one = await selected()
	expect(one.length).toBeGreaterThan(0)
	await page.keyboard.press('Shift+ArrowRight')
	await page.keyboard.press('Shift+ArrowRight')
	const three = await selected()
	expect(three.split(/\s+/).length).toBeGreaterThan(one.split(/\s+/).length)
	await page.keyboard.press('Shift+Meta+h')
	await expect(page.getByRole('dialog', { name: 'Tag selected words' })).toBeVisible()
	await closeApp(app)
})

test('native menu: New Study and Toggle Sidebar', async () => {
	const { app, page } = await launch(dirs)
	const click = (id: string) =>
		app.evaluate(
			({ Menu }, itemId) => Menu.getApplicationMenu()!.getMenuItemById(itemId)!.click(),
			id,
		)
	await click('sidebar.toggle')
	await expect(page.locator('#sidebar')).toBeHidden()
	await click('sidebar.toggle')
	await expect(page.locator('#sidebar')).toBeVisible()
	await click('study.new')
	await expect.poll(async () => (await studyFiles(dirs)).length).toBe(2)
	await click('passage.add')
	await expect(page.getByLabel('Reference')).toBeVisible()
	await closeApp(app)
})

test('note: create, edit text, options popover size and font', async () => {
	const { app, page } = await launch(dirs)
	await page.getByRole('main', { name: 'Study canvas' }).click({ position: { x: 20, y: 20 } })
	await page.keyboard.press('t')
	const area = page.getByRole('main', { name: 'Study canvas' })
	const box = (await area.boundingBox())!
	await page.mouse.click(box.x + 300, box.y + 200)
	const input = page.getByLabel('Note text')
	await expect(input).toBeVisible()
	await input.fill('Remember the covenant')
	await page.keyboard.press('Escape')
	const noteText = page.getByTestId('canvas').locator('span', { hasText: 'Remember the covenant' })
	await expect(noteText).toBeVisible()
	await noteText.click()
	await page.getByRole('button', { name: 'Note options' }).click()
	const options = page.getByRole('dialog', { name: 'Note options' })
	await options.getByRole('radio', { name: 'Size XL' }).or(options.getByLabel('Size XL')).click()
	await options.getByRole('radio', { name: 'Plain' }).or(options.getByText('Plain')).click()
	await page.keyboard.press('Escape')
	// Double-click reopens the note for editing and keeps focus in the text.
	await page.mouse.click(box.x + 20, box.y + box.height - 20)
	await noteText.dblclick()
	await expect(input).toBeFocused()
	await page.keyboard.type(' of grace')
	await page.keyboard.press('Escape')
	await saved(page)
	await closeApp(app)
	const file = await firstStudyFile(dirs)
	const note = records(await readStudy(file)).find((r) => r.type === 'margin-note')
	expect(note.props).toMatchObject({ size: 'XL', font: 'plain' })
	expect(JSON.stringify(note.props)).toContain('Remember the covenant of grace')
})

test('save failure: read-only study folder shows "Save failed" and Retry recovers', async () => {
	const { app, page } = await launch(dirs)
	await saved(page)
	await chmod(join(dirs.library, 'studies'), 0o555)
	await addAmos(page)
	const status = page.getByRole('status').filter({ hasText: 'Save failed' })
	await expect(status).toBeVisible({ timeout: 20_000 })
	await chmod(join(dirs.library, 'studies'), 0o755)
	await status.getByRole('button', { name: 'Retry' }).click()
	await saved(page)
	await closeApp(app)
	const file = await firstStudyFile(dirs)
	expect(JSON.stringify(await readStudy(file))).toContain('passage')
})

test('add verses: dialog JPS choice beats the Old Testament default; qualifier beats both', async () => {
	const { app, page } = await launch(dirs)
	await page.keyboard.press('Meta+,')
	await page.getByLabel('Old Testament translation').selectOption({ label: 'KJV' })
	await page.keyboard.press('Escape')
	const insert = async (reference: string, choose?: 'JPS 1917') => {
		await page.getByRole('button', { name: 'Add verses' }).first().click()
		await page.getByLabel('Reference').fill(reference)
		if (choose) await page.getByRole('radio', { name: choose }).click()
		const add = page.locator('.insert-actions .button-primary')
		await expect(add).toBeEnabled({ timeout: 15_000 })
		await add.click()
		await expect(page.getByRole('dialog', { name: 'Add verses' })).toBeHidden()
	}
	await insert('Psalm 23', 'JPS 1917')
	await insert('KJV Psalm 117')
	await expect
		.poll(async () => {
			const [file] = await studyFiles(dirs)
			return file
				? records(await readStudy(file))
						.filter((r) => r.type === 'passage')
						.map((r) => r.props.text.edition.translationId as string)
						.sort()
				: []
		})
		.toEqual(['jps1917', 'kjv'].sort())
	await closeApp(app)
})
