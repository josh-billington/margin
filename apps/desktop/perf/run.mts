/**
 * Performance budgets on a heavy study (150 verse blocks, 100 notes, 240 arrows).
 *
 *   pnpm test:perf                          this build alone, absolute medians
 *   tsx perf/run.mts --base <desktop dir>   alternate rounds against another built checkout
 *
 * Each round launches each build fresh, measures startup, then scripted zoom, pan and note
 * typing. A comparison fails when the head is slower than the base on a budget (perf/report.ts).
 */
import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { parseArgs } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { compare, markdown, percentile } from './report'
import type { Interaction, Sample } from './report'

const { values: options } = parseArgs({
	options: {
		base: { type: 'string' },
		rounds: { type: 'string' },
		out: { type: 'string', default: 'test-results/perf.json' },
	},
})
const headDir = resolve(import.meta.dirname, '..')
const builds = { head: headDir, ...(options.base && { base: resolve(options.base) }) }
const rounds = Number(options.rounds ?? (options.base ? 5 : 3))
const fixture = gunzipSync(await readFile(join(import.meta.dirname, 'heavy.study.json.gz')))
const studyId = (JSON.parse(fixture.toString('utf8')) as { id: string }).id

const MIME: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.wasm': 'application/wasm',
}

/** Same reason as e2e/harness.ts: an http origin keeps production tldraw's licence gate off. */
function serve(root: string) {
	return new Promise<string>((done) => {
		const server = createServer((request, response) => {
			const path = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/')
			readFile(join(root, path === '/' ? 'index.html' : path))
				.then((body) => {
					response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'text/html' })
					response.end(body)
				})
				.catch(() => {
					response.writeHead(404)
					response.end()
				})
		})
		server.unref()
		server.listen(0, '127.0.0.1', () => {
			const address = server.address()
			done(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/`)
		})
	})
}

async function prepare() {
	const root = await mkdtemp(join(tmpdir(), 'margin-perf-'))
	const userData = join(root, 'userData')
	const library = join(root, 'library')
	await mkdir(join(library, 'studies'), { recursive: true })
	await mkdir(userData, { recursive: true })
	await writeFile(join(library, 'studies', `${studyId}.study.json`), fixture)
	await writeFile(
		join(userData, 'prefs.json'),
		JSON.stringify({
			setup: 'done',
			preferences: {
				defaultTranslation: 'kjv',
				oldTestamentTranslation: 'kjv',
				defaultNoteFont: 'handwritten',
				displayNotesInPlainFont: false,
				lastOpenedStudyId: studyId,
				introSeen: true,
			},
			cameras: { [studyId]: { x: 30, y: 30, z: 0.65 } },
		}),
	)
	return { root, userData, library }
}

async function launch(
	appDir: string,
	rendererUrl: string,
	dirs: { userData: string; library: string },
) {
	const env: Record<string, string> = {}
	for (const [key, value] of Object.entries(process.env))
		if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE' && key !== 'MARGIN_LIBRARY_DIR')
			env[key] = value
	return electron.launch({
		// Each checkout runs on its own Electron, so a version bump is measured too.
		executablePath: createRequire(join(appDir, 'package.json'))('electron') as string,
		args: [appDir],
		env: {
			...env,
			MARGIN_USER_DATA_DIR: dirs.userData,
			MARGIN_LIBRARY_DIR: dirs.library,
			MARGIN_GLASS: '0',
			ELECTRON_RENDERER_URL: rendererUrl,
		},
		timeout: 120_000,
	})
}

const twoFrames = (page: Page) =>
	page.evaluate(
		() =>
			new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
	)

async function painted(page: Page) {
	await page.waitForFunction(
		() => (document.querySelector('.passage-block')?.getBoundingClientRect().height ?? 0) > 0,
		undefined,
		{ timeout: 120_000 },
	)
	await twoFrames(page)
}

/** Chromium's cumulative CPU accounting, in milliseconds. */
async function cpu(page: Page) {
	const session = await page.context().newCDPSession(page)
	await session.send('Performance.enable')
	return async () => {
		const { metrics } = await session.send('Performance.getMetrics')
		const value = (name: string) => (metrics.find((m) => m.name === name)?.value ?? 0) * 1000
		return {
			styleMs: value('RecalcStyleDuration'),
			layoutMs: value('LayoutDuration'),
			scriptMs: value('ScriptDuration'),
			taskMs: value('TaskDuration'),
		}
	}
}

async function measure(
	page: Page,
	read: Awaited<ReturnType<typeof cpu>>,
	action: () => Promise<void>,
) {
	await page.evaluate(() => {
		const w = window as unknown as { __perfFrames: number[]; __perfRun: boolean }
		w.__perfFrames = []
		w.__perfRun = true
		let last = performance.now()
		const tick = (now: number) => {
			if (!w.__perfRun) return
			w.__perfFrames.push(now - last)
			last = now
			requestAnimationFrame(tick)
		}
		requestAnimationFrame(tick)
	})
	const before = await read()
	await action()
	await page.waitForTimeout(400)
	const after = await read()
	const frames = await page.evaluate(() => {
		const w = window as unknown as { __perfFrames: number[]; __perfRun: boolean }
		w.__perfRun = false
		return w.__perfFrames.slice(1)
	})
	return {
		styleMs: after.styleMs - before.styleMs,
		layoutMs: after.layoutMs - before.layoutMs,
		scriptMs: after.scriptMs - before.scriptMs,
		taskMs: after.taskMs - before.taskMs,
		frameP95Ms: percentile(frames, 0.95),
		framesOver33: frames.filter((f) => f > 33.4).length,
	} satisfies Interaction
}

async function zoom(page: Page, read: Awaited<ReturnType<typeof cpu>>) {
	const zoomIn = page.getByRole('button', { name: 'Zoom in' })
	const zoomOut = page.getByRole('button', { name: 'Zoom out' })
	await zoomIn.click()
	await page.waitForTimeout(400)
	await zoomOut.click()
	await page.waitForTimeout(400)
	return measure(page, read, async () => {
		for (let i = 0; i < 20; i++) {
			await (i % 2 ? zoomOut : zoomIn).click()
			await page.waitForTimeout(150)
		}
	})
}

async function pan(page: Page, read: Awaited<ReturnType<typeof cpu>>) {
	const canvas = (await page.locator('[aria-label="Study canvas"]').boundingBox())!
	await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2)
	return measure(page, read, async () => {
		for (let i = 0; i < 90; i++) {
			await page.mouse.wheel(0, i < 45 ? 40 : -40)
			await page.waitForTimeout(16)
		}
	})
}

/** Types into a note already on the canvas, which stages and autosaves the whole study. */
async function typing(app: ElectronApplication, page: Page, read: Awaited<ReturnType<typeof cpu>>) {
	const note = await page.evaluate(() => {
		for (const el of document.querySelectorAll('.margin-note')) {
			const rect = el.getBoundingClientRect()
			if (
				rect.width &&
				rect.left > 0 &&
				rect.top > 0 &&
				rect.bottom < innerHeight &&
				rect.right < innerWidth
			)
				return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
		}
		throw new Error('No note is fully on screen')
	})
	await page.mouse.dblclick(note.x, note.y)
	await page.waitForFunction(() => {
		const el = document.activeElement as HTMLElement | null
		return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA')
	})
	await page.keyboard.press('End')
	await page.evaluate(() => {
		const w = window as unknown as { __perfKeys: number[] }
		w.__perfKeys = []
		document.addEventListener(
			'keydown',
			(event) => {
				const start = event.timeStamp
				requestAnimationFrame(() =>
					requestAnimationFrame(() => w.__perfKeys.push(performance.now() - start)),
				)
			},
			true,
		)
	})
	await app.evaluate(() => {
		const g = globalThis as unknown as { __perfGaps: number[]; __perfTimer: NodeJS.Timeout }
		g.__perfGaps = []
		let last = performance.now()
		g.__perfTimer = setInterval(() => {
			const now = performance.now()
			g.__perfGaps.push(Math.max(0, now - last - 5))
			last = now
		}, 5)
	})
	const result = await measure(page, read, async () => {
		await page.keyboard.type(' the word of the Lord', { delay: 30 })
		// Through the autosave debounce, so the save is part of the window.
		await page.waitForTimeout(800)
	})
	const gaps = await app.evaluate(() => {
		const g = globalThis as unknown as { __perfGaps: number[]; __perfTimer: NodeJS.Timeout }
		clearInterval(g.__perfTimer)
		return g.__perfGaps
	})
	const keys = await page.evaluate(() => (window as unknown as { __perfKeys: number[] }).__perfKeys)
	await page.keyboard.press('Escape')
	return {
		...result,
		keyP95Ms: percentile(keys, 0.95),
		keyMaxMs: Math.max(0, ...keys),
		mainDelayP95Ms: percentile(gaps, 0.95),
	}
}

async function run(build: Sample['build'], round: number, rendererUrl: string, full: boolean) {
	const dirs = await prepare()
	const start = performance.now()
	const app = await launch(builds[build]!, rendererUrl, dirs)
	try {
		const page = await app.firstWindow()
		page.on('pageerror', (error) =>
			process.stderr.write(`[${build}] page error: ${error.message}\n`),
		)
		await painted(page)
		const startupMs = performance.now() - start
		if (!full) return undefined
		await page.waitForFunction(
			() => !document.querySelector('.passage-block[data-arrival="pending"]'),
		)
		await page.waitForTimeout(1500)
		const read = await cpu(page)
		const sample: Sample = {
			build,
			round,
			startupMs,
			zoom: await zoom(page, read),
			pan: await pan(page, read),
			typing: await typing(app, page, read),
		}
		process.stdout.write(
			`round ${round} ${build}: startup ${Math.round(startupMs)} ms, zoom ${Math.round(sample.zoom.taskMs)} ms, pan ${Math.round(sample.pan.taskMs)} ms, key p95 ${Math.round(sample.typing.keyP95Ms)} ms\n`,
		)
		return sample
	} finally {
		await app.close().catch(() => undefined)
		await rm(dirs.root, { recursive: true, force: true })
	}
}

const urls = Object.fromEntries(
	await Promise.all(
		Object.entries(builds).map(async ([build, dir]) => [
			build,
			await serve(join(dir, 'out/renderer')),
		]),
	),
) as Record<Sample['build'], string>
const order = Object.keys(builds) as Sample['build'][]

// One unmeasured launch each, so the first measured round doesn't pay for a cold disk cache.
for (const build of order) await run(build, -1, urls[build], false)

const samples: Sample[] = []
for (let round = 0; round < rounds; round++) {
	// Alternate which build goes first, so drift on the runner lands on both evenly.
	for (const build of round % 2 ? [...order].reverse() : order) {
		const sample = await run(build, round, urls[build], true)
		if (sample) samples.push(sample)
	}
}

const out = resolve(options.out)
await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify(samples, null, '\t'))
const rows = compare(samples)
const report = markdown(rows, rounds)
process.stdout.write(`\n${report}\nRaw samples: ${out}\n`)
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report)
if (rows.some((row) => row.regressed)) process.exitCode = 1
