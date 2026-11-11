import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import {
	closeApp,
	firstStudyFile,
	launch,
	makeDirs,
	readStudy,
	records,
	removeDirs,
	saved,
} from './harness'

async function addVerse(page: Page, reference: string) {
	const count = await page.locator('.passage-block').count()
	await page.getByRole('button', { name: 'Add verses' }).first().click()
	await page.getByLabel('Reference').fill('KJV ' + reference)
	await expect(
		page.getByRole('dialog', { name: 'Add verses' }).getByRole('button', { name: /^Add verses?$/ }),
	).toBeEnabled({ timeout: 15_000 })
	await page.keyboard.press('Enter')
	await expect(page.getByRole('dialog', { name: 'Add verses' })).toBeHidden()
	await expect(page.locator('.passage-block')).toHaveCount(count + 1)
	await saved(page)
}

/** Playwright cannot drive a macOS menu. Activate its real first item at the native popup boundary. */
async function activateLookupMenu(app: ElectronApplication) {
	await app.evaluate(({ Menu }) => {
		Menu.prototype.popup = function (options) {
			const item = this.items[0]
			if (!item?.label.startsWith('Look up'))
				throw new Error('Lookup must be the first native item')
			;(globalThis as { lookupMenuLabel?: string }).lookupMenuLabel = item.label
			item.click()
			setTimeout(() => options?.callback?.(), 10)
		}
	})
}

const created = (page: Page) =>
	page
		.locator('[data-word]')
		.filter({ hasText: /^created$/ })
		.first()
const lookup = (page: Page) => page.getByRole('dialog', { name: 'Word lookup', exact: true })

test('right-click in every tool, transient lookup, dark/light popover, note + bound arrow saves and undoes together', async () => {
	const dirs = await makeDirs()
	const { app, page } = await launch(dirs)
	page.on('pageerror', (error) => console.error('Renderer error:', error))
	try {
		await activateLookupMenu(app)
		await addVerse(page, 'Genesis 1:1')
		const file = await firstStudyFile(dirs)
		await expect
			.poll(
				async () =>
					records(await readStudy(file)).filter((record) => record.type === 'passage').length,
			)
			.toBe(1)
		const before = await readFile(file, 'utf8')
		for (const tool of ['Select', 'Hand', 'Note', 'Arrow', 'Highlight']) {
			await page
				.getByRole('toolbar', { name: 'Canvas tools' })
				.getByRole('button', { name: tool, exact: true })
				.click()
			await created(page).click({ button: 'right' })
			await expect(lookup(page).getByText('H1254', { exact: true })).toBeVisible()
			await expect(lookup(page).locator('[lang="he"]')).toHaveAttribute('dir', 'rtl')
			await page.keyboard.press('Escape')
			await expect(lookup(page)).toBeHidden()
			await expect(page.locator('.passage-text')).toBeFocused()
		}
		expect(
			await app.evaluate(() => (globalThis as { lookupMenuLabel?: string }).lookupMenuLabel),
		).toBe('Look up “created”')
		await page.waitForTimeout(1000)
		expect(await readFile(file, 'utf8')).toBe(before)
		await created(page).click({ button: 'right' })
		await expect(lookup(page).getByText('H1254', { exact: true })).toBeVisible()
		await mkdir('/tmp/margin-shots/lookup', { recursive: true })
		for (const appearance of ['dark', 'light'] as const) {
			await page.evaluate((appearance) => window.margin.prefs.set({ appearance }), appearance)
			await expect(page.locator('html')).toHaveAttribute('data-appearance', appearance)
			if (!(await lookup(page).isVisible())) await created(page).click({ button: 'right' })
			await expect(lookup(page).getByText('H1254', { exact: true })).toBeVisible()
			await page.screenshot({
				path: `/tmp/margin-shots/lookup/${appearance}.png`,
				animations: 'disabled',
			})
		}
		await lookup(page).getByRole('button', { name: 'Add note' }).click()
		const readRecords = async () => records(await readStudy(file))
		await expect
			.poll(
				async () => (await readRecords()).filter((record) => record.type === 'margin-note').length,
			)
			.toBe(1)
		const doc = await readRecords()
		const note = doc.find((record) => record.type === 'margin-note')
		expect(note.props.font).toBe('plain')
		expect(note.props.text).toContain('H1254')
		expect(note.props.text).toContain("Strong's Hebrew Dictionary · H1254")
		expect(note.props.text).not.toContain('Open Scriptures')
		const arrow = doc.find((record) => record.typeName === 'shape' && record.type === 'arrow')
		expect(arrow).toBeTruthy()
		expect(
			doc.filter((record) => record.typeName === 'binding' && record.fromId === arrow.id),
		).toHaveLength(2)
		const wordBinding = doc.find(
			(record) =>
				record.typeName === 'binding' && record.fromId === arrow.id && record.meta?.target,
		)
		expect(wordBinding.meta.target).toEqual({
			verse: { book: 'GEN', chapter: 1, verse: 1 },
			token: 4,
		})
		await app.evaluate(({ Menu }) =>
			Menu.getApplicationMenu()?.getMenuItemById('edit.undo')?.click(),
		)
		await expect
			.poll(
				async () =>
					(await readRecords()).filter((record) => ['margin-note', 'arrow'].includes(record.type))
						.length,
			)
			.toBe(0)
		await app.evaluate(({ Menu }) =>
			Menu.getApplicationMenu()?.getMenuItemById('edit.redo')?.click(),
		)
		await expect
			.poll(
				async () => (await readRecords()).filter((record) => record.type === 'margin-note').length,
			)
			.toBe(1)
	} finally {
		await closeApp(app)
		await removeDirs(dirs)
	}
})

test('selection shortcut and palette, phrase chooser, supplied words, manual IDs and Greek entries', async () => {
	const dirs = await makeDirs()
	const { app, page } = await launch(dirs)
	page.on('pageerror', (error) => console.error('Renderer error:', error))
	try {
		await activateLookupMenu(app)
		await addVerse(page, 'John 1:1-3')
		const word = page
			.locator('[data-word]')
			.filter({ hasText: /^Word$/ })
			.first()
		await word.evaluate((element) => {
			const selection = window.getSelection()
			selection?.setBaseAndExtent(element, 0, element, element.childNodes.length)
			element.closest<HTMLElement>('.passage-text')?.focus()
		})
		await page.keyboard.press('Control+Meta+d')
		await expect(lookup(page).getByText('G3056', { exact: true })).toBeVisible()
		await page.keyboard.press('Escape')
		await page.keyboard.press('Meta+k')
		await page.getByRole('combobox').fill('Look up word')
		await expect(page.getByRole('option', { name: /^Look up word/ })).toContainText('⌃⌘D')
		await page.getByRole('option', { name: /^Look up word/ }).click()
		await expect(lookup(page).getByText('G3056', { exact: true })).toBeVisible()
		await page.keyboard.press('Escape')
		await addVerse(page, 'Genesis 1:2')
		const supplied = page
			.locator('[data-word][data-book="GEN"]')
			.filter({ hasText: /^was$/ })
			.last()
		await supplied.click({ button: 'right' })
		await expect(lookup(page)).toContainText('No source word — added in translation')
		await lookup(page).getByLabel('Strong’s number').fill('1254')
		await lookup(page).getByRole('button', { name: 'Look up number' }).click()
		await expect(lookup(page).getByRole('alert')).toContainText('Choose Hebrew or Greek')
		await lookup(page)
			.getByRole('combobox', { name: /^Dictionary/ })
			.selectOption('H')
		await lookup(page).getByRole('button', { name: 'Look up number' }).click()
		await expect(lookup(page).getByText('H1254', { exact: true })).toBeVisible()
		await page.keyboard.press('Escape')
		await addVerse(page, 'John 18:4')
		const seek = page
			.locator('[data-word]')
			.filter({ hasText: /^seek$/ })
			.last()
		await seek.click({ button: 'right' })
		await expect(lookup(page).getByRole('button', { name: /seek ye.*G2212/ })).toBeVisible()
		await lookup(page)
			.getByRole('button', { name: /seek ye.*G2212/ })
			.click()
		await expect(lookup(page).getByText('G2212', { exact: true })).toBeVisible()
		await lookup(page).getByRole('button', { name: 'Source words' }).click()
		await expect(lookup(page).getByRole('button', { name: /seek ye.*G2212/ })).toBeVisible()
	} finally {
		await closeApp(app)
		await removeDirs(dirs)
	}
})

test('multi-word source choices, replacement, copy citation and click-outside dismissal', async () => {
	const dirs = await makeDirs()
	const { app, page } = await launch(dirs)
	try {
		await activateLookupMenu(app)
		await addVerse(page, 'Genesis 1:1')
		await page
			.locator('[data-word]')
			.nth(3)
			.evaluate((element) => {
				const next = element.parentElement?.nextElementSibling?.querySelector('[data-word]')
				if (!next) throw new Error('Missing next word')
				element.closest<HTMLElement>('.passage-text')?.focus()
				window.getSelection()?.setBaseAndExtent(element, 0, next, next.childNodes.length)
			})
		await created(page).click({ button: 'right' })
		await expect(lookup(page).getByRole('button', { name: /God.*H430/ })).toBeVisible()
		await expect(lookup(page).getByRole('button', { name: /created.*H1254/ })).toBeVisible()
		expect(
			await app.evaluate(() => (globalThis as { lookupMenuLabel?: string }).lookupMenuLabel),
		).toBe('Look up selection')
		await lookup(page)
			.getByRole('button', { name: /created.*H1254/ })
			.click()
		await lookup(page).getByRole('button', { name: 'Copy', exact: true }).click()
		await expect
			.poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
			.toContain("Strong's Hebrew Dictionary · H1254")
		await page.evaluate(() => window.getSelection()?.removeAllRanges())
		await page.locator('[data-word]').nth(3).click({ button: 'right' })
		await expect(lookup(page).getByText('H430', { exact: true })).toBeVisible()
		await expect(lookup(page)).toHaveCount(1)
		await page.locator('.title-input').click()
		await expect(lookup(page)).toBeHidden()
		await expect(page.locator('.passage-text')).toBeFocused()
	} finally {
		await closeApp(app)
		await removeDirs(dirs)
	}
})
