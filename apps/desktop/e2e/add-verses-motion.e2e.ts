import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { closeApp, launch, makeDirs, removeDirs, saved } from './harness'

async function search(page: Page, query: string) {
	const dialog = page.getByRole('dialog', { name: 'Add verses' })
	await dialog.getByRole('combobox', { name: 'Reference or words to search' }).fill(query)
	return dialog
}

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
