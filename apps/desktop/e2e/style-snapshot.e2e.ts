import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { addAmos, closeApp, launch, makeDirs, removeDirs, selectWords } from './harness'
import type { Dirs } from './harness'

/*
 * Computed-style capture for the design-system work (docs/plans/design-system.md, "Proving each
 * PR"). Off unless STYLE_SNAPSHOT names an output folder. It walks the app through a fixed set of
 * states, on the Mac and iPad hosts in dark and light, and writes every element's computed style
 * (plus ::before and ::after) to one JSON file per state. Run it before and after a change, then
 * compare the folders with scripts/style-diff.mjs: a refactor that claims no visible change should
 * produce no difference.
 */

const out = process.env.STYLE_SNAPSHOT
test.skip(!out, 'Set STYLE_SNAPSHOT=<folder> to capture computed styles')
test.setTimeout(240_000)

/** Every element's computed style, keyed by a structural path that ignores class names. */
async function capture(page: Page) {
	// Let transitions and entry animations settle so the capture is the resting state.
	await page.evaluate(() =>
		Promise.all(
			document
				.getAnimations()
				.filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)
				// A cancelled animation rejects `finished`; it has stopped either way.
				.map((a) => a.finished.catch(() => null)),
		),
	)
	await page.waitForTimeout(150)
	return page.evaluate(() => {
		const pathOf = (el: Element): string => {
			const parts: string[] = []
			for (
				let node: Element | null = el;
				node && node !== document.documentElement;
				node = node.parentElement
			) {
				const parent: Element | null = node.parentElement
				const tag = node.tagName.toLowerCase()
				const same = parent
					? [...parent.children].filter((c) => c.tagName === node!.tagName)
					: [node]
				parts.unshift(same.length > 1 ? `${tag}[${same.indexOf(node) + 1}]` : tag)
			}
			return parts.join('>')
		}
		const read = (style: CSSStyleDeclaration) => {
			const entries: Record<string, string> = {}
			for (let i = 0; i < style.length; i++) {
				const name = style.item(i)
				entries[name] = style.getPropertyValue(name)
			}
			return entries
		}
		const styles: Record<string, Record<string, string>> = {}
		for (const el of [
			document.documentElement,
			...document.documentElement.querySelectorAll('*'),
		]) {
			const path = el === document.documentElement ? 'html' : pathOf(el)
			styles[path] = read(getComputedStyle(el))
			for (const pseudo of ['::before', '::after'] as const) {
				const style = getComputedStyle(el, pseudo)
				if (style.content && style.content !== 'none') styles[`${path}${pseudo}`] = read(style)
			}
		}
		return styles
	})
}

const states: {
	name: string
	reach: (page: Page) => Promise<void>
	leave?: (page: Page) => Promise<void>
}[] = [
	{ name: 'study', reach: async () => {} },
	{
		name: 'tag-popover',
		reach: async (page) => {
			await selectWords(page, 2)
			await page.keyboard.press('Meta+Shift+H')
			await expect(page.getByRole('dialog', { name: 'Tag selected words' })).toBeVisible()
		},
		leave: async (page) => {
			await page.keyboard.press('Escape')
			await expect(page.getByRole('dialog', { name: 'Tag selected words' })).toBeHidden()
		},
	},
	{
		name: 'palette',
		reach: async (page) => {
			await page.keyboard.press('Meta+k')
			await expect(page.locator('[cmdk-input]')).toBeVisible()
		},
		leave: async (page) => {
			await page.keyboard.press('Escape')
			await expect(page.locator('[cmdk-input]')).toBeHidden()
		},
	},
	{
		name: 'add-verses',
		reach: async (page) => {
			await page.getByRole('button', { name: 'Add verses' }).first().click()
			await page.getByLabel('Reference').fill('John 1:1-3')
			await expect(page.getByRole('button', { name: 'Add verses' }).last()).toBeEnabled({
				timeout: 15_000,
			})
		},
		leave: async (page) => {
			await page.keyboard.press('Escape')
			await expect(page.getByRole('dialog', { name: 'Add verses' })).toBeHidden()
		},
	},
	{
		name: 'settings',
		reach: async (page) => {
			await page.keyboard.press('Meta+,')
			await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
		},
		leave: async (page) => {
			await page.keyboard.press('Escape')
			await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()
		},
	},
]

for (const host of ['mac', 'ipad'] as const) {
	test(`style snapshot: ${host}`, async () => {
		const dirs: Dirs = await makeDirs()
		const { app, page } = await launch(dirs, host === 'ipad' ? { MARGIN_PLATFORM: 'ipad' } : {})
		try {
			await app.evaluate(({ BrowserWindow }) =>
				BrowserWindow.getAllWindows()[0]?.setSize(1280, 860),
			)
			await addAmos(page)
			await page.mouse.click(5, 5)
			await mkdir(out!, { recursive: true })
			for (const mode of ['dark', 'light'] as const) {
				await app.evaluate(({ nativeTheme }, m) => (nativeTheme.themeSource = m), mode)
				await expect
					.poll(() => page.evaluate(() => document.documentElement.dataset.appearance))
					.toBe(mode)
				for (const state of states) {
					await test.step(`${host} ${mode} ${state.name}`, async () => {
						await state.reach(page)
						const styles = await capture(page)
						await writeFile(
							join(out!, `${host}-${mode}-${state.name}.json`),
							JSON.stringify(styles),
						)
						await state.leave?.(page)
					})
				}
			}
		} finally {
			await closeApp(app)
			await removeDirs(dirs)
		}
	})
}
