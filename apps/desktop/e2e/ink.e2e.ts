import { expect, test } from '@playwright/test'
import type { CDPSession, Locator, Page } from '@playwright/test'
import {
	addAmos,
	closeApp,
	firstStudyFile,
	launch,
	makeDirs,
	readStudy,
	records,
	removeDirs,
} from './harness'

type Point = { x: number; y: number }

async function box(locator: Locator) {
	const rect = await locator.boundingBox()
	if (!rect) throw new Error('Drawing target is not visible')
	return rect
}

async function penStroke({
	cdp,
	from,
	through,
	to,
}: {
	cdp: CDPSession
	from: Point
	through: Point
	to: Point
}) {
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mousePressed',
		...from,
		pointerType: 'pen',
		button: 'left',
		buttons: 1,
		force: 0.35,
		clickCount: 1,
	})
	for (let step = 1; step <= 16; step++) {
		const t = step / 16
		const x = (1 - t) ** 2 * from.x + 2 * t * (1 - t) * through.x + t * t * to.x
		const y = (1 - t) ** 2 * from.y + 2 * t * (1 - t) * through.y + t * t * to.y
		await cdp.send('Input.dispatchMouseEvent', {
			type: 'mouseMoved',
			x,
			y,
			pointerType: 'pen',
			button: 'none',
			buttons: 1,
			force: 0.35 + 0.5 * t,
		})
	}
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mouseReleased',
		...to,
		pointerType: 'pen',
		button: 'left',
		buttons: 0,
		clickCount: 1,
	})
}

const tool = ({ page, name }: { page: Page; name: string }) =>
	page.getByRole('button', { name, exact: true })

test('iPad pen ink binds to words, stays in notes, and opens on Mac without drawing tools', async () => {
	const dirs = await makeDirs()
	let { app, page } = await launch(dirs, { MARGIN_PLATFORM: 'ipad' })
	try {
		await addAmos(page)
		const cdp = await page.context().newCDPSession(page)
		const start = await box(page.locator('[data-word]').nth(1))
		const end = await box(page.locator('[data-word]').nth(8))
		const from = { x: start.x + start.width / 2, y: start.y + start.height / 2 }
		const to = { x: end.x + end.width / 2, y: end.y + end.height / 2 }
		const ink = page.locator('[data-margin-ink="arrow"]')
		await tool({ page, name: 'Ink arrow' }).click()
		await penStroke({ cdp, from, through: { x: (from.x + to.x) / 2, y: from.y - 100 }, to })
		await expect(ink.locator('polygon')).toHaveCount(1)
		await tool({ page, name: 'Handwrite in a note' }).click()
		const canvas = await box(page.getByRole('main', { name: 'Study canvas' }))
		await page.mouse.click(canvas.x + 60, canvas.y + canvas.height - 235)
		const pad = page.getByRole('img', { name: 'Handwriting' })
		await expect(pad).toBeVisible()
		const note = await box(pad)
		await penStroke({
			cdp,
			from: { x: note.x + 20, y: note.y + 40 },
			through: { x: note.x + 60, y: note.y + 5 },
			to: { x: note.x + 100, y: note.y + 45 },
		})
		const path = await pad.locator('path').getAttribute('d')
		expect(path).toBeTruthy()
		await expect
			.poll(async () => {
				const study = await readStudy(await firstStudyFile(dirs))
				const anchors = records(study)
					.filter((record) => record.typeName === 'binding' && record.type === 'margin-ink')
					.map((record) => record.props.anchor.kind)
				return [study.schemaVersion, ...anchors]
			})
			.toEqual([2, 'word', 'word'])
		await closeApp(app)
		;({ app, page } = await launch(dirs, { MARGIN_PLATFORM: 'mac' }))
		await expect(tool({ page, name: 'Ink arrow' })).toHaveCount(0)
		await expect(tool({ page, name: 'Handwrite in a note' })).toHaveCount(0)
		await expect(page.locator('[data-margin-ink="arrow"] polygon')).toHaveCount(1)
		await expect(page.getByRole('img', { name: 'Handwriting' }).locator('path')).toHaveAttribute(
			'd',
			path ?? '',
		)
	} finally {
		await closeApp(app)
		await removeDirs(dirs)
	}
})
