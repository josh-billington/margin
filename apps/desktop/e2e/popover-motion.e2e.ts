import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { addAmos, center, closeApp, launch, makeDirs, removeDirs, wordAt } from './harness'

/** Amos with its first three words highlighted, back in the Select tool. */
async function highlighted(page: Page) {
	await addAmos(page)
	await page.keyboard.press('Escape')
	await page.keyboard.press('h')
	const from = await center(wordAt(page, 0))
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	const to = await center(wordAt(page, 2))
	await page.mouse.move(to.x, to.y, { steps: 8 })
	await page.mouse.up()
	await expect(page.locator('[data-word][data-tag-name="Highlight"]')).toHaveCount(3)
	await page.keyboard.press('v')
	return from
}

const popover = (page: Page) => page.locator('.tag-popover')

/** What the popover is animating: each animation's properties and its first and last frames. */
const animations = (page: Page) =>
	popover(page).evaluate((el) =>
		el.getAnimations().map((animation) => {
			const frames = (animation.effect as KeyframeEffect).getKeyframes()
			const props = Object.keys(frames[0]!).filter(
				(key) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key),
			)
			return {
				name: animation instanceof CSSAnimation ? animation.animationName : null,
				props,
				first: frames[0]!,
				last: frames.at(-1)!,
			}
		}),
	)

/** Holds the popover part way through what it is doing, so the next step starts from mid-motion. */
const holdAt = (page: Page, ms: number) =>
	popover(page).evaluate((el, at) => {
		for (const animation of el.getAnimations()) {
			animation.pause()
			animation.currentTime = at
		}
	}, ms)

/** The scale in a keyframe's `translate(…) scale(s)`. */
const scaleOf = (transform: unknown) => Number(/scale\(([\d.]+)\)/.exec(String(transform))?.[1])

const clickWord = async (page: Page, index: number) => {
	const { x, y } = await center(wordAt(page, index))
	await page.mouse.click(x, y)
}

test('fluid popover grows from the click, and reverses from mid-motion either way', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs, { MARGIN_E2E_FLUID_POPOVERS: '1' })
		try {
			const at = await highlighted(page)
			await page.mouse.click(at.x, at.y)
			await expect(popover(page)).toHaveAttribute('data-fluid', '')
			const opening = await animations(page)
			expect(opening.map((a) => a.props).sort()).toEqual([['opacity'], ['transform']])
			// Grows from the click, along the edge of the words that faces it (it opened below them).
			const origin = await popover(page).evaluate((el) => {
				const box = el.parentElement!.getBoundingClientRect()
				const [x, y] = getComputedStyle(el).transformOrigin.split(' ').map(parseFloat)
				return { x: box.left + x!, y: box.top + y!, side: el.dataset.side }
			})
			const word = (await wordAt(page, 0).boundingBox())!
			expect(origin.side).toBe('bottom')
			expect(Math.abs(origin.x - at.x)).toBeLessThan(1)
			expect(Math.abs(origin.y - (word.y + word.height))).toBeLessThan(2)

			// Dismissed mid-open: it leaves from where it was, not from fully open.
			await holdAt(page, 60)
			await clickWord(page, 6)
			const leaving = await animations(page)
			const shrink = leaving.find((a) => a.props.includes('transform'))!
			expect(scaleOf(shrink.first.transform)).toBeGreaterThan(0.95)
			expect(scaleOf(shrink.first.transform)).toBeLessThan(0.995)
			expect(scaleOf(shrink.last.transform)).toBeCloseTo(0.94, 3)
			await expect(popover(page)).toHaveCount(0)

			// Asked again while leaving: it comes back from where it is, never finishing the exit.
			await page.mouse.click(at.x, at.y)
			await expect.poll(async () => (await animations(page)).length).toBe(0)
			await clickWord(page, 6)
			await holdAt(page, 50)
			await page.mouse.click(at.x, at.y)
			const back = await animations(page)
			const grow = back.find((a) => a.props.includes('transform'))!
			expect(scaleOf(grow.first.transform)).toBeLessThan(1)
			expect(scaleOf(grow.first.transform)).toBeGreaterThan(0.95)
			expect(grow.last.transform).toBe('none')
			await expect(popover(page)).toBeVisible()
			await expect(popover(page)).toHaveCSS('pointer-events', 'auto')

			// From the keyboard it appears at once, focused, with nothing animating.
			await page.keyboard.press('Escape')
			await expect(popover(page)).toHaveCount(0)
			await page.locator('[data-word][data-tag-name="Highlight"]').first().focus()
			await page.keyboard.press('Enter')
			await expect(popover(page)).toBeVisible()
			expect(await animations(page)).toEqual([])
			expect(await popover(page).evaluate((el) => el.contains(document.activeElement))).toBe(true)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})

test('fluid popover under Reduce Motion only fades', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs, { MARGIN_E2E_FLUID_POPOVERS: '1' })
		try {
			await page.emulateMedia({ reducedMotion: 'reduce' })
			const at = await highlighted(page)
			await page.mouse.click(at.x, at.y)
			expect((await animations(page)).map((a) => a.props)).toEqual([['opacity']])
			await expect.poll(async () => (await animations(page)).length).toBe(0)
			await clickWord(page, 6)
			expect((await animations(page)).map((a) => a.props)).toEqual([['opacity']])
			await expect(popover(page)).toHaveCount(0)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})

test('with the switch off, the popover keeps its current pop-in', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs, { MARGIN_E2E_FLUID_POPOVERS: '0' })
		try {
			const at = await highlighted(page)
			await page.mouse.click(at.x, at.y)
			await expect(popover(page)).toBeVisible()
			await expect(popover(page)).not.toHaveAttribute('data-fluid')
			expect((await animations(page)).map((a) => a.name)).toEqual(['pop-in'])
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})
