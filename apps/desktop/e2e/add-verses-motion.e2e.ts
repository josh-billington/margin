import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { closeApp, launch, makeDirs, removeDirs, saved } from './harness'

async function search(page: Page, query: string) {
	const dialog = page.getByRole('dialog', { name: 'Add verses' })
	await dialog.getByRole('combobox', { name: 'Reference or words to search' }).fill(query)
	return dialog
}

/** Blocks still waiting to be placed are unseen; once none are, every block is where it stays. */
const arrived = (page: Page) =>
	expect(page.locator('.passage-block[data-arrival="pending"]')).toHaveCount(0)

test('adding several verses places them evenly, selects them and frames them all', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			await app.evaluate(({ BrowserWindow }) =>
				BrowserWindow.getAllWindows()[0]?.setSize(1280, 900),
			)
			await saved(page)
			// A long chapter fills the middle of the view, so the verses land below it, out of view.
			await page.keyboard.press('Meta+Shift+F')
			let dialog = await search(page, 'Psalm 119')
			await expect(dialog.locator('.insert-preview')).toContainText('Psalm 119')
			await page.keyboard.press('Enter')
			await expect(dialog).toBeHidden()
			await arrived(page)

			await page.keyboard.press('Meta+Shift+F')
			dialog = await search(page, 'mercies')
			await expect(dialog.getByRole('status')).toHaveText('44 verses found')
			await page.keyboard.press('ArrowDown')
			for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowDown')
			await expect(dialog.getByRole('button', { name: 'Add 4 verses' })).toBeEnabled()
			await page.keyboard.press('Enter')
			await expect(dialog).toBeHidden()
			await arrived(page)

			const titles = ['Genesis 32:10', '2 Samuel 24:14', '1 Chronicles 21:13', '2 Chronicles 6:42']
			const blocks = titles.map((title) =>
				page.locator('.tl-shape[data-shape-type="passage"]').filter({
					has: page.locator('.passage-header', { hasText: title }),
				}),
			)
			const canvas = (await page.getByRole('main', { name: 'Study canvas' }).boundingBox())!
			const toolbar = (await page.getByRole('toolbar', { name: 'Canvas tools' }).boundingBox())!
			// The view moves to them (an eased camera move): wait until it rests with all of them in it.
			await expect
				.poll(async () => {
					const boxes = await Promise.all(blocks.map((block) => block.boundingBox()))
					return boxes.every(
						(box) =>
							!!box &&
							box.y >= canvas.y &&
							box.y + box.height <= toolbar.y &&
							box.x >= canvas.x &&
							box.x + box.width <= canvas.x + canvas.width,
					)
				})
				.toBe(true)
			// In reading order, one under another, the same gap apart.
			const boxes = (await Promise.all(blocks.map((block) => block.boundingBox()))).map(
				(box) => box!,
			)
			const gaps = boxes
				.slice(1)
				.map((box, index) => box.y - boxes[index]!.y - boxes[index]!.height)
			for (const gap of gaps) expect(gap).toBeGreaterThan(20)
			expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(2)
			// Every added block is selected, not only the last.
			await expect(page.locator('.passage-resize-left')).toHaveCount(4)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})

test('Reduce Motion leaves Add verses with nothing moving', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			await page.emulateMedia({ reducedMotion: 'reduce' })
			await saved(page)
			// Every frame: the properties animating in the dialog and its overlay, and whether results show.
			await page.evaluate(() => {
				const frames: { results: boolean; animating: string[] }[] = []
				Object.assign(window, { __frames: frames })
				const tick = () => {
					const dialog = document.querySelector('.insert-dialog')
					const overlay = document.querySelector('.dialog-overlay')
					const animating = [dialog, overlay].flatMap((element) =>
						(element?.getAnimations({ subtree: true }) ?? [])
							.filter((animation) => animation.playState === 'running')
							.flatMap((animation) =>
								animation instanceof CSSTransition
									? [animation.transitionProperty]
									: ((animation.effect as KeyframeEffect | null)?.getKeyframes() ?? []).flatMap(
											(frame) =>
												Object.keys(frame).filter(
													(key) =>
														!['offset', 'computedOffset', 'easing', 'composite'].includes(key),
												),
										),
							),
					)
					frames.push({ results: !!dialog?.querySelector('.search-hit'), animating })
					requestAnimationFrame(tick)
				}
				tick()
			})
			// The pointer opens it with motion; the keyboard would open it instantly anyway.
			await page.getByRole('button', { name: 'Add verses' }).first().click()
			const opened = page.getByRole('dialog', { name: 'Add verses' })
			await opened.evaluate((element) =>
				Promise.all(element.getAnimations().map((animation) => animation.finished)),
			)
			const dialog = await search(page, 'mercies')
			await expect(dialog.getByRole('status')).toHaveText('44 verses found')
			await page.keyboard.press('ArrowDown')
			await page.keyboard.press('Shift+ArrowDown')
			await expect(dialog.getByRole('button', { name: 'Add 2 verses' })).toBeEnabled()
			type Frame = { results: boolean; animating: string[] }
			const frames = () =>
				page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames)
			const adding = (await frames()).length
			await page.keyboard.press('Enter')
			await expect(dialog).toBeHidden()
			const all = await frames()
			// Opening and closing fade at most: nothing scales, slides or resizes.
			expect(new Set(all.flatMap((frame) => frame.animating))).toEqual(new Set(['opacity']))
			// From the first results until Add, nothing animates at all: no widening, no list growing.
			const shown = all.findIndex((frame) => frame.results)
			expect(shown).toBeGreaterThan(-1)
			expect(all.slice(shown, adding).flatMap((frame) => frame.animating)).toEqual([])
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})
