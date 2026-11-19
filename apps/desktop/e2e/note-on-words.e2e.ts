import { expect, test } from '@playwright/test'
import {
	addAmos,
	closeApp,
	firstStudyFile,
	launch,
	makeDirs,
	readStudy,
	records,
	removeDirs,
	selectWords,
} from './harness'

test('note on selected words: T or the Note button adds a note already arrowed to them', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		// Narrow enough that the margin beside the block starts off-screen.
		await (await app.browserWindow(page)).evaluate((window) => window.setSize(900, 700))
		await addAmos(page)
		await page.keyboard.press('Escape')

		// Keyboard: select a phrase, press T, type, Escape.
		await selectWords(page, 2)
		await page.keyboard.press('t')
		const input = page.getByLabel('Note text')
		await expect(input).toBeFocused()
		await page.keyboard.type('Three transgressions')
		// The camera brings the new note fully into view.
		await expect
			.poll(async () => {
				const box = await input.boundingBox()
				const width = await page.evaluate(() => window.innerWidth)
				return !!box && box.x >= 0 && box.x + box.width <= width
			})
			.toBe(true)
		await page.keyboard.press('Escape')

		// Mouse: double-click a word to select it, click the toolbar Note button, type.
		const word = page.locator('[data-word]').nth(20)
		await word.dblclick()
		await page
			.getByRole('toolbar', { name: 'Canvas tools' })
			.getByRole('button', { name: 'Note', exact: true })
			.click()
		await expect(input).toBeFocused()
		await page.keyboard.type('One word')
		await page.keyboard.press('Escape')

		const file = await firstStudyFile(dirs)
		const state = async () => {
			const doc = records(await readStudy(file))
			const notes = doc.filter((r) => r.type === 'margin-note')
			const wordBindings = doc.filter((r) => r.typeName === 'binding' && r.meta?.target)
			const noteBindings = doc.filter(
				(r) => r.typeName === 'binding' && notes.some((n) => n.id === r.toId),
			)
			return {
				texts: notes.map((n) => n.props.text).sort(),
				wordBindings: wordBindings.length,
				noteBindings: noteBindings.length,
			}
		}
		await expect
			.poll(state)
			.toEqual({ texts: ['One word', 'Three transgressions'], wordBindings: 2, noteBindings: 2 })

		// One undo removes the note and its arrow together.
		await app.evaluate(({ Menu }) =>
			Menu.getApplicationMenu()?.getMenuItemById('edit.undo')?.click(),
		)
		await expect
			.poll(state)
			.toEqual({ texts: ['Three transgressions'], wordBindings: 1, noteBindings: 1 })
		await closeApp(app)
	} finally {
		await removeDirs(dirs)
	}
})
