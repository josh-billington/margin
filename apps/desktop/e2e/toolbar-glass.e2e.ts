import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { closeApp, launch, makeDirs, removeDirs } from './harness'
import type { Dirs } from './harness'

// The glass toolbar experiment (core app/toolbarGlass.tsx): off unless MARGIN_TOOLBAR_GLASS or the
// palette toggle turns it on; Mac only; Reduce Transparency and Increase Contrast keep it solid.

let dirs: Dirs
test.beforeEach(async () => {
	dirs = await makeDirs()
})
test.afterEach(async () => {
	await removeDirs(dirs)
})

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Canvas tools' })
const material = (page: Page) =>
	page.evaluate(() => {
		const bar = document.querySelector<HTMLElement>('.canvas-toolbar')!
		const style = getComputedStyle(bar)
		return {
			lens: bar.dataset.lens ?? null,
			background: style.backgroundColor,
			radius: style.borderTopLeftRadius,
			backdrop: style.backdropFilter,
			filters: document.querySelectorAll('.toolbar-lens-defs feDisplacementMap').length,
		}
	})

test('glass toolbar: off by default and not listed in the palette', async () => {
	const { app, page } = await launch(dirs, { MARGIN_TOOLBAR_GLASS: '' })
	try {
		await expect(toolbar(page)).toBeVisible()
		expect(await material(page)).toMatchObject({ lens: null, backdrop: 'none', filters: 0 })
		await page.keyboard.press('Meta+k')
		await page.locator('[cmdk-input]').fill('glass')
		await expect(page.getByRole('option', { name: 'Toggle glass toolbar' })).toHaveCount(0)
	} finally {
		await closeApp(app)
	}
})

test('glass toolbar: MARGIN_TOOLBAR_GLASS=1 refracts at the rim; the palette turns it off', async () => {
	const { app, page } = await launch(dirs, { MARGIN_TOOLBAR_GLASS: '1' })
	try {
		await expect(toolbar(page)).toHaveAttribute('data-lens', '')
		const on = await material(page)
		expect(on).toMatchObject({ radius: '999px', filters: 1 })
		expect(on.background).toMatch(/^rgba\(.*, 0\.6\d*\)$/)
		expect(on.backdrop).toMatch(/^url\("#toolbar-lens-\d+"\) blur\(/)

		await page.keyboard.press('Meta+k')
		await page.locator('[cmdk-input]').fill('glass')
		await page.getByRole('option', { name: 'Toggle glass toolbar' }).click()
		await expect(toolbar(page)).not.toHaveAttribute('data-lens')
		expect(await material(page)).toMatchObject({ backdrop: 'none', filters: 0, radius: '11px' })
		expect(await page.evaluate(() => localStorage.getItem('margin.toolbarGlass'))).toBe('0')
	} finally {
		await closeApp(app)
	}
})

test('glass toolbar: Reduce Transparency and Increase Contrast keep the solid toolbar', async () => {
	const { app, page } = await launch(dirs, { MARGIN_TOOLBAR_GLASS: '1' })
	try {
		await expect(toolbar(page)).toHaveAttribute('data-lens', '')
		const solid = await (async () => {
			const cdp = await page.context().newCDPSession(page)
			const results = []
			for (const feature of [
				{ name: 'prefers-reduced-transparency', value: 'reduce' },
				{ name: 'prefers-contrast', value: 'more' },
			]) {
				await cdp.send('Emulation.setEmulatedMedia', { features: [feature] })
				results.push(await material(page))
			}
			await cdp.send('Emulation.setEmulatedMedia', { features: [] })
			return results
		})()
		for (const state of solid) {
			expect(state).toMatchObject({ backdrop: 'none', radius: '11px' })
			expect(state.background).toMatch(/^rgb\(/)
		}
		expect(await material(page)).toMatchObject({ radius: '999px' })
	} finally {
		await closeApp(app)
	}
})

test('glass toolbar: the iPad keeps its toolbar', async () => {
	const { app, page } = await launch(dirs, { MARGIN_PLATFORM: 'ipad', MARGIN_TOOLBAR_GLASS: '1' })
	try {
		await expect(toolbar(page)).toBeVisible()
		expect(await material(page)).toMatchObject({ lens: null, backdrop: 'none', filters: 0 })
	} finally {
		await closeApp(app)
	}
})
