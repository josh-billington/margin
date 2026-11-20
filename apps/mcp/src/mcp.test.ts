import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { resolveLibraryPath } from './library'
import { outlineMarkdown } from './markdown'
import { outlineStudy, searchStudy, summarizeStudy } from './outline'
import { listOutput, outlineOutput, searchOutput } from './schema'
import { createServer } from './server'
import { fixtureId, fixtureStudy, newerId, unreadableId } from './study.fixture'
import { parseStudy } from './study'

let home: string
beforeEach(async () => {
	home = await mkdtemp(join(tmpdir(), 'margin-mcp-test-'))
})
afterEach(async () => {
	await rm(home, { recursive: true, force: true })
})

it('orders the outline by page position and describes scripture, highlights, notes and arrows', () => {
	const study = parseStudy(fixtureStudy())
	const outline = outlineStudy({ study, includeItalics: true })
	expect(outline.blocks.map(({ id }) => id)).toEqual([
		'shape:question',
		'shape:passage-left',
		'shape:passage-right',
		'shape:free',
	])
	expect(outline.blocks[0]).toMatchObject({
		kind: 'note',
		attachment: { kind: 'verse', verse: 'Amos 5:24' },
	})
	expect(outline.blocks[3]).toMatchObject({
		kind: 'note',
		handwrittenInk: true,
		attachment: { kind: 'free', nearest: { passageId: 'shape:passage-right' } },
	})
	expect(outline.blocks[2]).toMatchObject({
		reference: 'Amos 5:24–25',
		translation: 'King James Version',
		verses: [
			{ text: 'Judgment, let it run.', italicSpans: [{ start: 10, end: 13 }] },
			{ text: 'Sacrifices?', paragraphBreakBefore: true },
		],
		highlights: [
			{
				quote: 'Judgment, let',
				reference: 'Amos 5:24',
				style: { kind: 'tag', tag: { name: 'Justice' } },
			},
			{
				quote: 'it run. Sacrifices?',
				reference: 'Amos 5:24–25',
				style: { kind: 'color', color: 'amber' },
			},
		],
	})
	expect(outline.arrows[0]).toMatchObject({
		from: { kind: 'note', noteId: 'shape:question' },
		to: { kind: 'word', quote: 'Judgment,', verse: 'Amos 5:24' },
		description: 'From note “What does justice look like here?” to “Judgment,” (Amos 5:24)',
	})
	const markdown = outlineMarkdown(outline)
	expect(markdown).toContain('**24** Judgment, *let* it run')
	expect(markdown).toContain('handwritten ink, not transcribed')
	expect(markdown).not.toContain('PRIVATE-EDITION-LABEL')
	expect(outlineMarkdown(outlineStudy({ study, includeItalics: false }))).not.toContain('*let*')
	expect(summarizeStudy(study)).toMatchObject({
		counts: { highlights: 2, notes: 2, arrows: 1 },
		passages: ['Amos 5:23 (King James Version)', 'Amos 5:24–25 (King James Version)'],
	})
})

it('describes a Pencil ink arrow like a regular arrow', () => {
	const study = fixtureStudy()
	const store = Object.fromEntries(
		Object.entries(study.document.store).map(([id, record]) => {
			if (id === 'shape:arrow')
				return [
					id,
					{
						...record,
						type: 'margin-ink',
						props: { kind: 'arrow', points: [{ x: 0, y: 0, z: 0.5 }], size: 2 },
					},
				]
			if (id === 'binding:start' || id === 'binding:end') {
				const { meta, ...rest } = record
				const target = 'target' in meta ? meta.target : undefined
				const point = { x: 0, y: 0 }
				return [
					id,
					{
						...rest,
						type: 'margin-ink',
						meta: {},
						props: {
							terminal: id === 'binding:start' ? 'start' : 'end',
							anchor: target
								? { kind: 'word', point, target, direction: point }
								: { kind: 'block', point },
						},
					},
				]
			}
			return [id, record]
		}),
	)
	const outline = outlineStudy({
		study: parseStudy({ ...study, schemaVersion: 2, document: { ...study.document, store } }),
		includeItalics: true,
	})
	expect(outline.arrows[0]?.description).toBe(
		'From note “What does justice look like here?” to “Judgment,” (Amos 5:24)',
	)
})
it('searches titles, typed notes, and references without matching verse text or treating input as a regex', () => {
	const study = parseStudy(fixtureStudy())
	expect(searchStudy({ study, query: 'jUsTiCe' })?.matches).toEqual([
		{ field: 'title', snippet: 'Worship and Justice' },
		{ field: 'note', snippet: 'What does justice look like here?' },
	])
	expect(searchStudy({ study, query: 'amos 5:25' })?.matches).toEqual([
		{ field: 'reference', snippet: 'Amos 5:25' },
	])
	expect(searchStudy({ study, query: 'Sacrifices' })).toBeNull()
	expect(searchStudy({ study, query: '.*' })).toBeNull()
})

it('resolves library path in CLI, environment, prefs, default order', async () => {
	const prefsDir = join(home, 'Library', 'Application Support', 'Margin')
	await mkdir(prefsDir, { recursive: true })
	const prefs = join(prefsDir, 'prefs.json')
	await writeFile(prefs, JSON.stringify({ libraryPath: '~/from-prefs', otherSetting: true }))
	const env = { MARGIN_LIBRARY_DIR: '~/from-env' }
	expect(await resolveLibraryPath({ args: ['--library', '~/from-cli'], env, home })).toBe(
		join(home, 'from-cli'),
	)
	expect(await resolveLibraryPath({ args: [], env, home })).toBe(join(home, 'from-env'))
	expect(await resolveLibraryPath({ args: [], env: {}, home })).toBe(join(home, 'from-prefs'))
	await writeFile(prefs, '{invalid')
	expect(await resolveLibraryPath({ args: [], env: {}, home })).toBe(
		join(home, 'Documents', 'Margin'),
	)
})

async function fileState(path: string) {
	const metadata = await stat(path, { bigint: true })
	const hash = !metadata.isDirectory()
		? createHash('sha256')
				.update(await readFile(path))
				.digest('hex')
		: null
	return { mtime: metadata.mtimeNs, hash }
}

async function libraryState(path: string) {
	const root = await readdir(path)
	const studies = await readdir(join(path, 'studies'))
	return Promise.all(
		[...root, ...studies.map((name) => join('studies', name))]
			.sort()
			.map(async (name) => [name, await fileState(join(path, name))]),
	)
}

it('serves MCP output schemas and errors without rewriting an index, changing study files or taking a lock', async () => {
	const directory = join(home, 'studies')
	await mkdir(directory)
	await writeFile(join(home, 'library.json'), '[]')
	await writeFile(join(home, '.margin-lock'), 'existing lock')
	await writeFile(join(directory, `${fixtureId}.study.json`), JSON.stringify(fixtureStudy()))
	await writeFile(
		join(directory, `${newerId}.study.json`),
		JSON.stringify({ ...fixtureStudy(), id: newerId, schemaVersion: 99 }),
	)
	await writeFile(join(directory, `${unreadableId}.study.json`), '{broken')
	const before = await libraryState(home)
	const client = new Client({ name: 'margin-test', version: '1.0.0' })
	const server = createServer(home)
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
	try {
		await server.connect(serverTransport)
		await client.connect(clientTransport)
		const { tools } = await client.listTools()
		expect(tools.map(({ name }) => name)).toEqual(['list_studies', 'get_study', 'search_studies'])
		expect(
			tools.every(({ annotations, outputSchema }) => annotations?.readOnlyHint && outputSchema),
		).toBe(true)
		const list = await client.callTool({ name: 'list_studies' })
		expect(listOutput.parse(list.structuredContent)).toMatchObject({
			studies: [{ id: fixtureId }],
			warnings: [{ id: newerId }, { id: unreadableId }],
		})
		const get = await client.callTool({ name: 'get_study', arguments: { id: fixtureId } })
		expect(outlineOutput.parse(get.structuredContent).id).toBe(fixtureId)
		const search = await client.callTool({
			name: 'search_studies',
			arguments: { query: 'justice' },
		})
		expect(searchOutput.parse(search.structuredContent).studies[0]?.id).toBe(fixtureId)
		const missing = '01ARZ3NDEKTSV4RRFFQ69G5FB1'
		const failures: [id: string, message: string][] = [
			[missing, 'No study found'],
			[newerId, 'needs a newer version of Margin'],
			[unreadableId, 'unreadable'],
		]
		for (const [id, message] of failures) {
			const failure = await client.callTool({ name: 'get_study', arguments: { id } })
			expect(failure).toMatchObject({
				isError: true,
				content: [{ type: 'text', text: expect.stringContaining(message) }],
			})
		}
		expect(await libraryState(home)).toEqual(before)
	} finally {
		await client.close()
		await server.close()
	}
})
