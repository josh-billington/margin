import { expect, test } from '@playwright/test'
import type { CDPSession, Locator, Page } from '@playwright/test'
import {
	addAmos,
	center,
	closeApp,
	firstStudyFile,
	launch,
	makeDirs,
	readStudy,
	records,
	removeDirs,
	wordAt,
} from './harness'

type Point = { x: number; y: number }

async function box(locator: Locator) {
	const rect = await locator.boundingBox()
	if (!rect) throw new Error('Drawing target is not visible')
	return rect
}

type Path = [Point, ...Point[]]

function arc({ from, through, to }: { from: Point; through: Point; to: Point }): Path {
	return [
		from,
		...Array.from({ length: 16 }, (_, index) => {
			const progress = (index + 1) / 16
			const start = (1 - progress) ** 2
			const middle = 2 * progress * (1 - progress)
			const end = progress ** 2
			return {
				x: start * from.x + middle * through.x + end * to.x,
				y: start * from.y + middle * through.y + end * to.y,
			}
		}),
	]
}

async function penStroke({ cdp, points }: { cdp: CDPSession; points: Path }) {
	const [from, ...moves] = points
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mousePressed',
		...from,
		pointerType: 'pen',
		button: 'left',
		buttons: 1,
		force: 0.35,
		clickCount: 1,
	})
	for (const [index, point] of moves.entries()) {
		await cdp.send('Input.dispatchMouseEvent', {
			type: 'mouseMoved',
			...point,
			pointerType: 'pen',
			button: 'none',
			buttons: 1,
			force: 0.35 + 0.5 * ((index + 1) / moves.length),
		})
	}
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mouseReleased',
		...(moves.at(-1) ?? from),
		pointerType: 'pen',
		button: 'left',
		buttons: 0,
		clickCount: 1,
	})
}

async function fingerStroke({ cdp, points }: { cdp: CDPSession; points: Path }) {
	const [start, ...moves] = points
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
	for (const point of moves)
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

const tool = ({ page, name }: { page: Page; name: string }) =>
	page.getByRole('button', { name, exact: true })

test('iPad infers Pencil and finger ink, undoes one stroke, and reopens it on Mac', async () => {
	const dirs = await makeDirs()
	let { app, page } = await launch(dirs, { MARGIN_PLATFORM: 'ipad' })
	try {
		await addAmos(page)
		const cdp = await page.context().newCDPSession(page)
		const arrowheads = page.locator('[data-margin-ink="arrow"] polygon')
		const plain = page.locator('[data-margin-ink="ink"]')
		const handwriting = page.getByRole('img', { name: 'Handwriting' }).locator('path')
		const from = await center(wordAt(page, 1))
		const to = await center(wordAt(page, 8))
		const betweenWords = arc({ from, through: { x: (from.x + to.x) / 2, y: from.y - 100 }, to })
		const undo = () => tool({ page, name: 'Undo' }).click()
		await expect(tool({ page, name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
		await expect(tool({ page, name: 'Arrow' })).toHaveCount(0)
		await expect(tool({ page, name: 'Ink arrow' })).toHaveCount(0)
		await expect(tool({ page, name: 'Handwrite in a note' })).toHaveCount(0)
		await test.step('pen in Select binds both words, with one undo step', async () => {
			await penStroke({ cdp, points: betweenWords })
			await expect(arrowheads).toHaveCount(1)
			await undo()
			await expect(arrowheads).toHaveCount(0)
			await expect(wordAt(page, 1)).toBeVisible()
			await tool({ page, name: 'Redo' }).click()
			await expect(arrowheads).toHaveCount(1)
		})
		await test.step('a closed circle and a stroke with one empty endpoint stay plain', async () => {
			const circle: Path = [
				from,
				...Array.from({ length: 32 }, (_, index) => {
					const angle = ((index + 1) / 32) * Math.PI * 2
					return { x: from.x + 30 * (1 - Math.cos(angle)), y: from.y + 21 * Math.sin(angle) }
				}),
			]
			await penStroke({ cdp, points: circle })
			await expect(plain).toHaveCount(1)
			await expect(plain.locator('polygon')).toHaveCount(0)
			await penStroke({ cdp, points: [from, { x: from.x, y: from.y - 95 }] })
			await expect(plain).toHaveCount(2)
			await expect(arrowheads).toHaveCount(1)
			await undo()
			await expect(plain).toHaveCount(1)
		})
		await test.step('Note mode places a note, then pen in Select writes in it', async () => {
			const canvas = await box(page.getByRole('main', { name: 'Study canvas' }))
			await tool({ page, name: 'Note' }).click()
			await penStroke({ cdp, points: [{ x: canvas.x + 60, y: canvas.y + canvas.height - 235 }] })
			const text = page.getByRole('textbox', { name: 'Note text' })
			await expect(text).toBeFocused()
			await text.fill('Observation')
			await text.press('Escape')
			const note = await box(page.locator('.margin-note'))
			const start = { x: note.x + 10, y: note.y + 20 }
			await penStroke({
				cdp,
				points: arc({
					from: start,
					through: { x: start.x + 32, y: start.y - 16 },
					to: { x: start.x + 60, y: start.y + 2 },
				}),
			})
			await expect(handwriting).toHaveCount(1)
			await penStroke({ cdp, points: [start, { x: start.x - 25, y: start.y - 28 }, start] })
			await expect(plain).toHaveCount(2)
			await expect(handwriting).toHaveCount(1)
			await undo()
			await penStroke({ cdp, points: [start, from] })
			await expect(arrowheads).toHaveCount(2)
			await expect(handwriting).toHaveCount(1)
			await undo()
			await expect(arrowheads).toHaveCount(1)
		})
		await test.step('pen in Highlight still highlights', async () => {
			await tool({ page, name: 'Highlight' }).click()
			await penStroke({ cdp, points: [from, to] })
			await expect
				.poll(async () => {
					const study = await readStudy(await firstStudyFile(dirs))
					return records(study).find((record) => record.type === 'passage')?.props.highlights.length
				})
				.toBe(1)
			await expect(arrowheads).toHaveCount(1)
			await expect(plain).toHaveCount(1)
		})
		await test.step('pen in Hand draws; finger pans in Select and Hand, then draws in Draw', async () => {
			await tool({ page, name: 'Hand' }).click()
			await penStroke({ cdp, points: betweenWords })
			await expect(arrowheads).toHaveCount(2)
			await undo()
			await expect(arrowheads).toHaveCount(1)
			await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
			for (const name of ['Select', 'Hand']) {
				await tool({ page, name }).click()
				const start = await center(wordAt(page, 1))
				await fingerStroke({ cdp, points: [start, { x: start.x + 45, y: start.y + 35 }] })
				await expect
					.poll(async () => (await center(wordAt(page, 1))).x)
					.toBeGreaterThan(start.x + 25)
				await expect(plain).toHaveCount(1)
				await expect(arrowheads).toHaveCount(1)
			}
			const draw = tool({ page, name: 'Draw' })
			await draw.click()
			await expect(draw).toHaveAttribute('aria-pressed', 'true')
			const start = await center(wordAt(page, 1))
			const end = await center(wordAt(page, 8))
			await fingerStroke({
				cdp,
				points: arc({ from: start, through: { x: start.x, y: start.y + 65 }, to: end }),
			})
			await expect(arrowheads).toHaveCount(2)
			await undo()
			await expect(arrowheads).toHaveCount(1)
		})
		const path = await handwriting.getAttribute('d')
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
		await expect(tool({ page, name: 'Draw' })).toHaveCount(0)
		await expect(tool({ page, name: 'Arrow' })).toHaveCount(1)
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
