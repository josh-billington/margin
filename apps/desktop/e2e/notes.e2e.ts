import { expect, test } from '@playwright/test'
import {
	closeApp,
	firstStudyFile,
	launch,
	makeDirs,
	readStudy,
	records,
	removeDirs,
} from './harness'
test('notes save however editing ends: click away, Escape, double-click create', async () => {
	const dirs = await makeDirs()
	const { app, page } = await launch(dirs)
	const area = page.getByRole('main', { name: 'Study canvas' })
	const box = (await area.boundingBox())!
	const notes = async () =>
		records(await readStudy(await firstStudyFile(dirs)))
			.filter((r) => r.type === 'margin-note')
			.map((r) => r.props.text)
	// 1: toolbar Note, click, type, click away
	await page
		.getByRole('toolbar', { name: 'Canvas tools' })
		.getByRole('button', { name: 'Note', exact: true })
		.click()
	await page.mouse.click(box.x + 200, box.y + 150)
	await page.waitForTimeout(100)
	await page.keyboard.type('first note')
	await page.mouse.click(box.x + 600, box.y + 500)
	await expect.poll(notes).toEqual(['first note'])
	// 2: T key, click, type, Escape
	await page.keyboard.press('t')
	await page.mouse.click(box.x + 200, box.y + 300)
	await page.waitForTimeout(100)
	await page.keyboard.type('second note')
	await page.keyboard.press('Escape')
	await expect.poll(async () => (await notes()).sort()).toEqual(['first note', 'second note'])
	// 3: double-click empty canvas, type, click away
	await page.mouse.dblclick(box.x + 500, box.y + 250)
	await page.waitForTimeout(100)
	await page.keyboard.type('third note')
	await page.mouse.click(box.x + 700, box.y + 100)
	await expect
		.poll(async () => (await notes()).sort())
		.toEqual(['first note', 'second note', 'third note'])
	await closeApp(app)
	expect((await notes()).sort()).toEqual(['first note', 'second note', 'third note'])
	await removeDirs(dirs)
})
