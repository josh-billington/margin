import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import {
	addAmos,
	center,
	closeApp,
	createTagFromPopover,
	launch,
	makeDirs,
	readStudy,
	records,
	removeDirs,
	saved,
	selectWords,
	firstStudyFile,
	wordAt,
} from './harness'

test('M0: highlight + word-bound arrow survive close and relaunch', async () => {
	const dirs = await makeDirs()
	try {
		let { app, page } = await launch(dirs)
		await addAmos(page)
		await selectWords(page, 2)
		await page.keyboard.press('Meta+Shift+H')
		await createTagFromPopover(page, 'Judgment')
		await expect(page.locator('[data-word][data-tag-name="Judgment"]')).toHaveCount(3)

		// Word-bound arrow: Arrow tool, drag from empty canvas onto a word.
		const target = wordAt(page, 20)
		const targetText = (await target.textContent())!.trim()
		const to = await center(target)
		await page.keyboard.press('Escape')
		await page.keyboard.press('a')
		await page.mouse.move(to.x + 200, to.y - 250)
		await page.mouse.down()
		await page.mouse.move(to.x + 30, to.y - 20, { steps: 10 })
		await page.mouse.move(to.x, to.y, { steps: 5 })
		await expect(page.locator('.word-anchor-preview')).toHaveCount(1)
		await page.mouse.up()
		// The temporary target-word underline ends with the arrow interaction.
		await expect(page.locator('.word-anchor-preview')).toHaveCount(0)
		await saved(page)
		await closeApp(app)

		const file = await firstStudyFile(dirs)
		const before = await readStudy(file)
		const binding = records(before).find((r) => r.typeName === 'binding')
		expect(binding, 'arrow binding saved').toBeTruthy()
		const targetMeta = binding.meta.target ?? binding.meta
		expect(JSON.stringify(targetMeta)).toContain('"token"')

		;({ app, page } = await launch(dirs))
		await expect(page.locator('[data-word][data-tag-name="Judgment"]')).toHaveCount(3)
		await expect(wordAt(page, 20)).toHaveText(new RegExp(targetText.replace(/[^\w]/g, '')))
		await saved(page)
		await closeApp(app)
		const after = records(await readStudy(file)).find((r) => r.typeName === 'binding')
		expect(after.meta).toEqual(binding.meta)
	} finally {
		await removeDirs(dirs)
	}
})

test('M0: a study keeps its stored snapshot when the bundled corpus differs', async () => {
	const dirs = await makeDirs()
	try {
		let { app, page } = await launch(dirs)
		await addAmos(page)
		await saved(page)
		await closeApp(app)

		// Simulate a study saved against an older corpus: different revision and different stored text.
		const file = await firstStudyFile(dirs)
		const study = await readStudy(file)
		const passage = records(study).find((r) => r.typeName === 'shape' && r.type === 'passage')
		const text = passage.props.text
		const staleRevision = `${text.edition.corpusRevision}-older`
		text.edition.corpusRevision = staleRevision
		text.verses[0].tokens[0].runs[0].text = 'Hence'
		await writeFile(file, JSON.stringify(study))

		;({ app, page } = await launch(dirs))
		await expect(wordAt(page, 0)).toHaveText('Hence')
		await page.waitForTimeout(1500)
		await closeApp(app)
		const after = records(await readStudy(file)).find((r) => r.type === 'passage')
		expect(after.props.text.edition.corpusRevision).toBe(staleRevision)
		expect(after.props.text.verses[0].tokens[0].runs[0].text).toBe('Hence')
	} finally {
		await removeDirs(dirs)
	}
})
