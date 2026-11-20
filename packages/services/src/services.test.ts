import { z } from 'zod'
import { expect, it, vi } from 'vitest'
import { deflateSync } from 'fflate'
import { translationIdSchema, verseRefSchema } from '@margin/contract/bible/types'
import type { TranslationId, VerseRef } from '@margin/contract/bible/types'
import { tokenize } from '@margin/contract/bible/tokenizer'
import { STORAGE_VERSION, encodeVerseRuns } from '@margin/contract/bible/storage'
import { createServices } from './services'
import { createServiceApi } from './api'
import { FileError, silentDiagnostics } from './ports'
import type { Database, FileStore, Ports } from './ports'
import { hasher, codec } from './codecs'
import { LEXICON_STORAGE_VERSION, tokenFingerprint } from './lexicon/storage'

class MemoryFiles implements FileStore {
	readonly contents = new Map<string, string>()
	private directories = new Set([''])
	async read(path: string) {
		const value = this.contents.get(path)
		if (value === undefined) throw new FileError('missing', path)
		return value
	}
	async list(dir: string) {
		if (!this.directories.has(dir)) throw new FileError('missing', dir)
		const prefix = dir ? dir + '/' : ''
		return [
			...new Set(
				[...this.contents.keys(), ...this.directories]
					.filter((path) => path.startsWith(prefix) && path !== dir)
					.map((path) => path.slice(prefix.length).split('/')[0] ?? ''),
			),
		]
	}
	async writeAtomic({ path, content, beforeReplace }: Parameters<FileStore['writeAtomic']>[0]) {
		await this.makeDir(path.split('/').slice(0, -1).join('/'))
		await beforeReplace?.()
		this.contents.set(path, content)
	}
	async createExclusive({ path, content }: Parameters<FileStore['createExclusive']>[0]) {
		if (this.contents.has(path)) return false
		this.contents.set(path, content)
		return true
	}
	async remove(path: string) {
		this.contents.delete(path)
	}
	async makeDir(path: string) {
		const parts = path.split('/')
		for (let i = 1; i <= parts.length; i++) this.directories.add(parts.slice(0, i).join('/'))
	}
	async modifiedAt() {
		return 0
	}
	async move({ from, to }: Parameters<FileStore['move']>[0]) {
		this.contents.set(to, await this.read(from))
		this.contents.delete(from)
	}
}
const edition = (translationId: TranslationId) => ({
	translationId,
	editionName: translationId,
	versificationId: 'test',
	corpusRevision: 'test',
	tokenizerVersion: 'test',
})
const refs: VerseRef[] = [
	{ book: 'GEN', chapter: 1, verse: 1 },
	{ book: 'GEN', chapter: 1, verse: 2 },
]
const tokens = tokenize('God created.')
class MemoryCorpus implements Database {
	closed = false
	selections = 0
	constructor(private readonly corpus: 'bible' | 'lexicon') {}
	async userVersion() {
		return this.corpus === 'bible' ? STORAGE_VERSION : LEXICON_STORAGE_VERSION
	}
	async close() {
		this.closed = true
	}
	async get(sql: string, params: readonly unknown[] = []): Promise<unknown> {
		if (sql.includes('FROM editions')) return edition(translationIdSchema.parse(params[0]))
		if (sql.includes('FROM metadata')) return { edition: JSON.stringify(edition('kjv')) }
		if (sql.includes('FROM bdb_entries')) {
			if (params[0] !== 'H1254') return undefined
			return {
				data: JSON.stringify([
					{
						id: 'b.cw.aa',
						lemma: 'בָּרָא',
						gloss: 'shape',
						pos: 'verb',
						senses: [{ label: 'Qal', text: [{ kind: 'def', text: 'create' }], senses: [] }],
					},
				]),
			}
		}
		if (sql.includes('FROM entries'))
			return {
				data: JSON.stringify({
					id: 'H1254',
					lemma: 'ברא',
					transliteration: 'bara',
					definition: 'create',
					renderings: 'created',
					derivation: '',
					source: 'Test dictionary',
				}),
			}
		throw new Error(`Unexpected get: ${sql}`)
	}
	async all(sql: string, params: readonly unknown[] = []): Promise<readonly unknown[]> {
		if (sql.includes('FROM books')) return [{ id: 'GEN' }]
		if (this.corpus === 'lexicon') {
			this.selections++
			const selected = z.array(verseRefSchema).parse(JSON.parse(z.string().parse(params[0])))
			return refs
				.filter((ref) =>
					selected.some(
						(value) =>
							value.book === ref.book && value.chapter === ref.chapter && value.verse === ref.verse,
					),
				)
				.map((ref) => ({
					...ref,
					fingerprint: tokenFingerprint(tokens),
					spans: deflateSync(new TextEncoder().encode(JSON.stringify([[1, 1, ['H1254']]]))),
				}))
		}
		if (!sql.includes('content')) return refs
		return refs.map((ref) => ({
			...ref,
			paragraphBreakBefore: 0,
			content: encodeVerseRuns(tokens),
		}))
	}
}

function fixture() {
	const library = new MemoryFiles()
	const appData = new MemoryFiles()
	const databases: MemoryCorpus[] = []
	const clipboard: string[] = []
	const ports: Ports = {
		openDatabase: async (corpus) => {
			const db = new MemoryCorpus(corpus)
			databases.push(db)
			return db
		},
		library: () => ({ files: library, watch: { watch: () => ({ close: async () => {} }) } }),
		appData,
		host: {
			current: () => ({ pid: 1, hostname: 'test-host', acquiredAt: '2026-01-01T00:00:00.000Z' }),
			isAlive: () => true,
		},
		clock: { now: () => Date.parse('2026-01-01T00:00:00.000Z') },
		hasher,
		codec,
		diagnostics: silentDiagnostics,
		ui: {
			pickFolder: async () => null,
			confirmDiscard: async () => 'keep',
			requestRendererFlush: async () => true,
			emit: () => {},
			describeFolder: (path) => ({ name: path, location: '' }),
			appearanceChanged: () => {},
			copyText: (text) => {
				clipboard.push(text)
			},
			showLookupMenu: async () => {},
		},
		configuration: { defaultLibraryPath: 'library', setupComplete: true },
	}
	return { library, ports, clipboard, databases }
}

const document = {
	store: {
		'page:page': {
			id: 'page:page',
			typeName: 'page',
			name: 'Page',
			index: 'a1',
			meta: { schemaVersion: 1, tags: [] },
		},
	},
	schema: { schemaVersion: 2, sequences: {} },
}

it('rejects invalid snapshots and path IDs at the iPad binding without changing the original', async () => {
	const { ports, library } = fixture()
	const services = await createServices(ports)
	const api = createServiceApi(services).library
	const created = await api.createStudy({ title: 'Original', document })
	if (!created.ok) throw new Error(created.error.message)
	const study = created.data
	const diagram = {
		id: 'shape:diagram',
		typeName: 'shape',
		type: 'geo',
		parentId: 'page:page',
		x: 0,
		y: 0,
		rotation: 0,
		index: 'a1',
		isLocked: false,
		opacity: 1,
		meta: { marginDiagram: true },
		props: {},
	}
	const path = `studies/${study.id}.study.json`
	const original = await library.read(path)
	for (const invalid of [
		{ ...study, document: { ...document, store: {} } },
		{ ...study, title: '' },
		{ ...study, document: { ...document, store: { ...document.store, [diagram.id]: diagram } } },
	]) {
		const request = { study: invalid, sequence: 1, base: original }
		expect(await api.stageStudy(request)).toMatchObject({ ok: false })
		expect(await api.saveStudy(request)).toMatchObject({ ok: false })
	}
	expect(await api.openStudy({ studyId: '../outside' })).toMatchObject({
		ok: false,
		error: { code: 'INVALID_REQUEST' },
	})
	expect(await api.flush()).toMatchObject({ ok: true })
	expect(await library.read(path)).toBe(original)
	await services.close()
})

it.each(['rename', 'delete', 'create'] as const)(
	'demotes the first owner before %s after a second owner takes over',
	async (operation) => {
		const { ports, library } = fixture()
		const notify = vi.fn()
		ports.ui.emit = notify
		const first = await createServices(ports)
		const api = createServiceApi(first).library
		const created = await api.createStudy({ title: 'Original', document })
		if (!created.ok) throw new Error(created.error.message)
		const study = created.data
		const second = await createServices({
			...ports,
			appData: new MemoryFiles(),
			host: { current: () => ({ hostname: 'second' }), isAlive: () => true },
		})
		const other = createServiceApi(second).library
		expect(await other.takeOver()).toMatchObject({ ok: true, data: { readOnly: false } })
		const action =
			operation === 'rename'
				? api.saveStudy({
						study: { ...study, title: 'Renamed' },
						sequence: 2,
						base: JSON.stringify(study),
					})
				: operation === 'delete'
					? api.deleteStudy({ studyId: study.id })
					: api.createStudy({ title: 'New', document })
		expect(await action).toMatchObject({ ok: false })
		expect(await api.getLibrary()).toMatchObject({ data: { readOnly: true } })
		expect(notify).toHaveBeenCalledWith({ kind: 'lock-lost' })
		expect(await library.list('studies')).toEqual([`${study.id}.study.json`])
		expect(JSON.parse(await library.read(`studies/${study.id}.study.json`))).toEqual(study)
		await api.closeStudy({ studyId: study.id })
		await first.close()
		expect(await other.createStudy({ title: 'Allowed', document })).toMatchObject({ ok: true })
		await second.close()
	},
)

it('preserves a newer stage received during an unchanged save', async () => {
	const { ports, library } = fixture()
	ports.ui.confirmDiscard = async () => 'discard'
	const services = await createServices(ports)
	const handlers = services.handlers
	const created = await handlers['margin:library:create-study']({ title: 'Original', document })
	if (!created.ok) throw new Error(created.error.message)
	const study = created.data
	const read = library.read.bind(library)
	const hook = vi.spyOn(library, 'read').mockImplementation(async (path) => {
		if (path.endsWith('.study.json')) {
			hook.mockRestore()
			await handlers['margin:library:stage']({ study: { ...study, title: 'Newer' }, sequence: 2 })
		}
		return read(path)
	})
	await handlers['margin:library:save-study']({ study, sequence: 1, base: JSON.stringify(study) })
	await services.requestClose({ quit: true })
	const folder = `recovery/${study.id}`
	const versions = await ports.appData.list(folder)
	expect(versions).toHaveLength(1)
	expect(JSON.parse(await ports.appData.read(`${folder}/${versions[0]}`))).toMatchObject({
		title: 'Newer',
	})
	await services.close()
})

it('requires explicit loss confirmation when the latest snapshot never reached an empty stage map', async () => {
	const { ports } = fixture()
	ports.ui.requestRendererFlush = async () => false
	ports.ui.confirmDiscard = async ({ loseChanges }) => (loseChanges ? 'keep' : 'discard')
	const services = await createServices(ports)
	try {
		expect(await services.requestClose({ quit: true })).toBe(false)
	} finally {
		await services.close()
	}
})

it('runs corpus lookups and a library save/conflict/reopen round trip through portable ports', async () => {
	const { ports, library, clipboard, databases } = fixture()
	const services = await createServices(ports)
	try {
		const passage = await services.handlers['margin:bible:get-passage']({
			translationId: 'kjv',
			ranges: [
				{
					start: { book: 'GEN', chapter: 1, verse: 1 },
					end: { book: 'GEN', chapter: 1, verse: 2 },
				},
			],
		})
		if (!passage.ok) throw new Error(passage.error.message)
		expect(passage.data.verses).toHaveLength(2)
		const lookup = await services.handlers['margin:lexicon:selection']({
			text: passage.data,
			start: { verse: { book: 'GEN', chapter: 1, verse: 1 }, token: 1 },
			end: { verse: { book: 'GEN', chapter: 1, verse: 2 }, token: 1 },
		})
		expect(lookup).toMatchObject({
			ok: true,
			data: { status: 'matched', spans: [{ ids: ['H1254'] }, { ids: ['H1254'] }] },
		})
		expect(databases.find((db) => db.selections)?.selections).toBe(1)
		expect(await services.handlers['margin:lexicon:entry']({ id: 'H1254' })).toMatchObject({
			ok: true,
			data: { definition: 'create' },
		})
		expect(await services.handlers['margin:lexicon:bdb-entries']({ id: 'H01254' })).toMatchObject({
			ok: true,
			data: [{ gloss: 'shape', senses: [{ text: [{ kind: 'def', text: 'create' }] }] }],
		})
		for (const id of ['H9999', 'G3056']) {
			expect(await services.handlers['margin:lexicon:bdb-entries']({ id })).toEqual({
				ok: true,
				data: [],
			})
		}
		expect(
			await services.handlers['margin:lexicon:copy-entry']({ id: 'H1254', dictionary: 'bdb' }),
		).toEqual({
			ok: true,
			data: null,
		})
		expect(clipboard).toEqual(['shape\nverb\nQal: create\nBrown-Driver-Briggs · H1254'])
		const created = await services.handlers['margin:library:create-study']({
			title: 'Original',
			document: {
				store: {
					'page:page': {
						id: 'page:page',
						typeName: 'page',
						name: 'Page',
						index: 'a1',
						meta: { schemaVersion: 1, tags: [] },
					},
				},
				schema: { schemaVersion: 2, sequences: {} },
			},
		})
		if (!created.ok) throw new Error(created.error.message)
		const saved = await services.handlers['margin:library:save-study']({
			study: { ...created.data, title: 'Saved' },
			sequence: 1,
			base: JSON.stringify(created.data),
		})
		if (!saved.ok) throw new Error(saved.error.message)
		expect(saved.data).toMatchObject({ conflict: false, study: { revision: 1, title: 'Saved' } })
		await library.writeAtomic({
			path: `studies/${created.data.id}.study.json`,
			content: JSON.stringify({ ...saved.data.study, title: 'External', revision: 2 }),
		})
		const conflict = await services.handlers['margin:library:save-study']({
			study: { ...saved.data.study, title: 'Local' },
			sequence: 2,
			base: JSON.stringify(saved.data.study),
		})
		if (!conflict.ok) throw new Error(conflict.error.message)
		expect(conflict.data).toMatchObject({
			conflict: true,
			study: { title: 'Local (conflict copy)' },
		})
		await services.close()
		const reopened = await createServices(ports)
		try {
			expect(
				await reopened.handlers['margin:library:open-study']({ studyId: created.data.id }),
			).toMatchObject({ ok: true, data: { title: 'External', revision: 2 } })
			expect(
				await reopened.handlers['margin:library:open-study']({ studyId: conflict.data.study.id }),
			).toMatchObject({ ok: true, data: { title: 'Local (conflict copy)' } })
		} finally {
			await reopened.close()
		}
	} finally {
		await services.close()
	}
	expect(databases.every((db) => db.closed)).toBe(true)
})
