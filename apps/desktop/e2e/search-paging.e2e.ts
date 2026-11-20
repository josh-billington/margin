import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { closeApp, launch, makeDirs, removeDirs, saved } from './harness'

/** Few enough rows stay rendered that a 1,000-verse list costs the same as a 20-verse one. */
const MAX_RENDERED = 60

async function openSearch(page: Page, query: string) {
	await page.keyboard.press('Meta+Shift+F')
	const dialog = page.getByRole('dialog', { name: 'Add verses' })
	await dialog.getByRole('combobox', { name: 'Reference or words to search' }).fill(query)
	const list = dialog.getByRole('listbox', { name: 'Matching verses' })
	return { dialog, list, status: dialog.locator('.search-status [role="status"]') }
}

const rendered = (list: Locator) => list.getByRole('option').count()
const active = (list: Locator) =>
	list.evaluate((element) => {
		const id = element.getAttribute('aria-activedescendant')
		const option = id ? document.getElementById(id) : null
		return option ? Number(option.getAttribute('aria-posinset')) : -1
	})

test('search results page in as the list scrolls, with only nearby rows rendered', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			await saved(page)
			const { list, status } = await openSearch(page, 'the lord said')
			await expect(status).toHaveText('Showing 200 of 1,067 verses')
			const first = list.getByRole('option').first()
			await expect(first).toHaveAttribute('aria-setsize', '1067')
			await expect(first).toHaveAttribute('aria-posinset', '1')
			// Scrolling to the end of what's loaded brings in the next page, until all are loaded.
			let most = 0
			for (let step = 0; step < 40; step++) {
				if ((await status.textContent()) === '1,067 verses found') break
				await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
				await page.waitForTimeout(80)
				most = Math.max(most, await rendered(list))
			}
			await expect(status).toHaveText('1,067 verses found')
			await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
			await expect(list.getByRole('option').last()).toHaveAttribute('aria-posinset', '1067')
			expect(most).toBeGreaterThan(0)
			expect(most).toBeLessThan(MAX_RENDERED)
			// One heading per book, even where a book spans a page boundary.
			const headings = await list.evaluate((element) => {
				const books = [...element.querySelectorAll('.search-row.search-group-heading')].map(
					(heading) => heading.firstChild?.textContent,
				)
				return books.length === new Set(books).size
			})
			expect(headings).toBe(true)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})

test('End and ArrowDown load more pages from the keyboard', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			await saved(page)
			const { list, status } = await openSearch(page, 'the lord said')
			await expect(status).toHaveText('Showing 200 of 1,067 verses')
			await page.keyboard.press('ArrowDown')
			await expect(list).toBeFocused()
			// Holding ArrowDown walks past the first page.
			for (let step = 0; step < 205; step++) await page.keyboard.press('ArrowDown')
			expect(await active(list)).toBe(206)
			await expect(status).toHaveText('Showing 400 of 1,067 verses')
			// End goes to the last verse, loading every page on the way.
			await page.keyboard.press('End')
			await expect(status).toHaveText('1,067 verses found')
			await expect.poll(() => active(list)).toBe(1067)
			await expect(list.locator('[data-active="true"]')).toBeInViewport()
			await page.keyboard.press('Home')
			await expect.poll(() => active(list)).toBe(1)
			await expect(list.locator('[data-active="true"]')).toBeInViewport()
			expect(await rendered(list)).toBeLessThan(MAX_RENDERED)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})

test('a Shift range across a page boundary adds every verse in it', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			await saved(page)
			const { dialog, list, status } = await openSearch(page, 'the lord said')
			await expect(status).toHaveText('Showing 200 of 1,067 verses')
			await page.keyboard.press('ArrowDown')
			for (let step = 0; step < 196; step++) await page.keyboard.press('ArrowDown')
			expect(await active(list)).toBe(197)
			for (let step = 0; step < 6; step++) await page.keyboard.press('Shift+ArrowDown')
			expect(await active(list)).toBe(203)
			await expect(status).toHaveText('Showing 400 of 1,067 verses')
			const chosen = await list
				.locator('[aria-selected="true"]')
				.evaluateAll((options) =>
					options.map((option) => option.querySelector('.search-hit-ref')?.textContent ?? ''),
				)
			expect(chosen).toHaveLength(7)
			// The range is data, not DOM: scrolled out of view (only the active row stays rendered),
			// it is still added in full.
			await list.evaluate((element) => element.scrollTo({ top: 0 }))
			await expect(list.locator('[aria-selected="true"]')).toHaveCount(1)
			await dialog.getByRole('button', { name: 'Add 7 verses' }).click()
			await expect(dialog).toBeHidden()
			// Consecutive verses share a block; each other verse is its own.
			const runs = chosen.reduce<string[][]>((blocks, label) => {
				const [, chapter, verse] = label.match(/^(.*):(\d+)$/) ?? []
				const previous = blocks
					.at(-1)
					?.at(-1)
					?.match(/^(.*):(\d+)$/)
				if (previous && previous[1] === chapter && Number(previous[2]) + 1 === Number(verse))
					blocks.at(-1)?.push(label)
				else blocks.push([label])
				return blocks
			}, [])
			await expect(page.locator('.passage-header')).toHaveCount(runs.length)
			for (const [label] of runs)
				await expect(
					page.locator('.passage-header').filter({ hasText: label ?? '' }),
				).not.toHaveCount(0)
			await saved(page)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})

test('an oversized Shift-End selection stays open and can be reduced', async () => {
	test.setTimeout(90_000)
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			await saved(page)
			const { dialog, list, status } = await openSearch(page, 'the')
			await expect(status).toHaveText('Showing 200 of 24,091 verses')
			await page.keyboard.press('ArrowDown')
			await expect(list).toBeFocused()
			await page.keyboard.press('Shift+End')
			await expect(status).toHaveText('24,091 verses found', { timeout: 60_000 })
			const add = dialog.getByRole('button', { name: 'Add 24,091 verses' })
			await add.click()
			await expect(dialog.getByRole('alert')).toContainText('Select fewer verses')
			await expect(add).toBeEnabled()
			await expect(page.locator('.passage-block')).toHaveCount(0)
			await list.focus()
			await page.keyboard.press('Home')
			await list.getByRole('option').first().click()
			await dialog.getByRole('button', { name: 'Add verse', exact: true }).click()
			await expect(dialog).toBeHidden()
			await expect(page.locator('.passage-block')).toHaveCount(1)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})

test('the dialog widens on the Mac while results show and its rows re-measure', async () => {
	const dirs = await makeDirs()
	try {
		const { app, page } = await launch(dirs)
		try {
			await saved(page)
			const { dialog, list, status } = await openSearch(page, 'Psalm 23')
			await expect(dialog.locator('.insert-preview')).toContainText('Psalm 23')
			const narrow = (await dialog.boundingBox())?.width ?? 0
			await dialog
				.getByRole('combobox', { name: 'Reference or words to search' })
				.fill('the lord said')
			await expect(status).toHaveText('Showing 200 of 1,067 verses')
			await expect
				.poll(async () => (await dialog.boundingBox())?.width)
				.toBeGreaterThan(narrow + 150)
			const viewport = page.viewportSize() ?? (await page.evaluate(() => ({ width: innerWidth })))
			expect((await dialog.boundingBox())?.width).toBeLessThanOrEqual(Math.min(680, viewport.width))
			// Rows re-measure at the new width: no gaps or overlaps between neighbours.
			await page.waitForTimeout(400)
			const gaps = await list.evaluate((element) => {
				const rows = [...element.querySelectorAll<HTMLElement>('.search-row')]
					.map((row) => row.getBoundingClientRect())
					.sort((left, right) => left.top - right.top)
				return rows.slice(1).map((row, index) => Math.round(row.top - (rows[index]?.bottom ?? 0)))
			})
			expect(gaps).toEqual(gaps.map(() => 0))
			// Editing back to a reference keeps the width, so it never flips while typing.
			await dialog.getByRole('combobox', { name: 'Reference or words to search' }).fill('Psalm 23')
			await expect(dialog.locator('.insert-preview')).toContainText('Psalm 23')
			expect((await dialog.boundingBox())?.width).toBeGreaterThan(narrow + 150)
		} finally {
			await closeApp(app)
		}
	} finally {
		await removeDirs(dirs)
	}
})
