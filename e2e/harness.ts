import { _electron as electron, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'

export interface Dirs {
	userData: string
	library: string
}

export async function makeDirs(): Promise<Dirs> {
	const root = await mkdtemp(join(tmpdir(), 'margin-e2e-'))
	return { userData: join(root, 'userData'), library: join(root, 'library') }
}

export async function removeDirs(dirs: Dirs) {
	await rm(resolve(dirs.userData, '..'), { recursive: true, force: true })
}

export interface Launched {
	app: ElectronApplication
	page: Page
}

const MIME: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.wasm': 'application/wasm',
}
let rendererServer: Promise<string> | undefined
/**
 * Serves out/renderer over loopback http. Production tldraw gates an unlicensed editor off five
 * seconds after mount (it is the release blocker in docs/STATUS.md), but treats an http origin as
 * development, so a file:// renderer would blank mid-test. The app loads this URL through its
 * unpackaged ELECTRON_RENDERER_URL path; the packaged test still runs the real file:// build.
 */
function serveRenderer(): Promise<string> {
	rendererServer ??= new Promise((resolveUrl) => {
		const root = resolve(__dirname, '../out/renderer')
		const server: Server = createServer((request, response) => {
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
			resolveUrl(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/`)
		})
	})
	return rendererServer
}

/** Launches the built app (out/main) with test-only data redirects; never touches real app data. */
export async function launch(
	dirs: Dirs,
	extraEnv: Record<string, string> = {},
	options: { executablePath?: string; args?: string[] } = {},
): Promise<Launched> {
	const env: Record<string, string> = {}
	for (const [key, value] of Object.entries(process.env))
		if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') env[key] = value
	const rendererUrl = options.executablePath ? undefined : await serveRenderer()
	const app = await electron.launch({
		executablePath: options.executablePath,
		args: options.executablePath
			? (options.args ?? [])
			: [resolve(__dirname, '..'), ...(options.args ?? [])],
		env: {
			...env,
			MARGIN_USER_DATA_DIR: dirs.userData,
			MARGIN_LIBRARY_DIR: dirs.library,
			MARGIN_GLASS: '0',
			...(rendererUrl ? { ELECTRON_RENDERER_URL: rendererUrl } : {}),
			...extraEnv,
		},
	})
	const page = await app.firstWindow()
	await page.waitForSelector('[aria-label="Study canvas"]')
	return { app, page }
}

export async function closeApp(app: ElectronApplication) {
	await app.close().catch(() => undefined)
}

export async function studyFiles(dirs: Dirs): Promise<string[]> {
	const folder = join(dirs.library, 'studies')
	const names = await readdir(folder).catch(() => [] as string[])
	return names.filter((name) => name.endsWith('.study.json')).map((name) => join(folder, name))
}

export async function readStudy(path: string) {
	return JSON.parse(await readFile(path, 'utf8')) as Record<string, any>
}

export const saved = (page: Page) =>
	expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()

export async function addAmos(page: Page) {
	await page.getByRole('button', { name: 'Add verses' }).first().click()
	await page.getByLabel('Reference').fill('Amos 1:3-5')
	await expect(page.getByRole('button', { name: 'Add verses' }).last()).toBeEnabled({ timeout: 15_000 })
	await page.keyboard.press('Enter')
	await page.waitForSelector('[data-word]')
}

/** Selects words by keyboard (first ArrowRight lands on a word), then opens the tag popover. */
export async function selectWords(page: Page, extend: number) {
	await page.locator('.passage-text').focus()
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('ArrowRight')
	for (let i = 0; i < extend; i++) await page.keyboard.press('Shift+ArrowRight')
}

export async function createTagFromPopover(page: Page, name: string) {
	const dialog = page.getByRole('dialog', { name: 'Tag selected words' })
	await dialog.getByPlaceholder('Name').fill(name)
	await dialog.getByRole('button', { name: 'Create and apply' }).click()
}

export function wordAt(page: Page, index: number) {
	return page.locator('[data-word]').nth(index)
}

export async function center(locator: ReturnType<Page['locator']>) {
	const box = (await locator.boundingBox())!
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Study document records, flattened from the saved file. */
export function records(study: Record<string, any>): any[] {
	const doc = study.document
	const store = doc?.store ?? doc?.document?.store ?? doc?.snapshot?.document?.store ?? {}
	return Array.isArray(store) ? store : Object.values(store)
}

export async function firstStudyFile(dirs: Dirs): Promise<string> {
	const [file] = await studyFiles(dirs)
	if (!file) throw new Error('No study file was written')
	return file
}
