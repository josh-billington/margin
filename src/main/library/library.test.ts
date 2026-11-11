import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'
import { Library, type LibraryEvent } from './library'
import { atomicWrite } from './atomic'
import { migrateStudy, UnsupportedStudyVersion } from '../../shared/study/migrations'

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
let root: string
let library: Library
let events: LibraryEvent[]
let fail = false
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'margin-test-'))
	events = []
	fail = false
	library = await new Library(
		join(root, 'library'),
		join(root, 'private'),
		async (path, content) => {
			if (fail && path.endsWith('.study.json')) throw new Error('Disk full')
			await atomicWrite(path, content)
		},
	).initialize(false)
	library.onEvent = (event) => events.push(event)
})
afterEach(async () => {
	await library.close().catch(() => {})
	await rm(root, { recursive: true, force: true })
})
const disk = async (id: string) =>
	migrateStudy(JSON.parse(await readFile(library.file(id), 'utf8')))

describe('library persistence', () => {
	it('creates the library and rebuilds a stale or missing index from validated files', async () => {
		const study = await library.create('Amos', document)
		await writeFile(join(library.path, 'library.json'), 'stale')
		expect(await library.list()).toEqual([
			{ id: study.id, title: 'Amos', updatedAt: study.updatedAt },
		])
		expect(JSON.parse(await readFile(join(library.path, 'library.json'), 'utf8'))).toMatchObject([
			{ id: study.id },
		])
		await rm(join(library.path, 'library.json'))
		await library.list()
		expect(await readFile(join(library.path, 'library.json'), 'utf8')).toContain(study.id)
	})
	it('does not advance revision or replace the disk file on write failure; retries work', async () => {
		const study = await library.create('Before', document)
		fail = true
		await expect(library.save({ ...study, title: 'After' }, 1)).rejects.toThrow('Disk full')
		expect(await disk(study.id)).toEqual(study)
		fail = false
		expect((await library.save({ ...study, title: 'After' }, 2)).study).toMatchObject({
			title: 'After',
			revision: 1,
		})
	})
	it('allows saving a copy and flushing after a failed write has settled', async () => {
		const study = await library.create('Before', document)
		fail = true
		await expect(library.save({ ...study, title: 'Unsaved' }, 1)).rejects.toThrow('Disk full')
		fail = false
		const copy = await library.create('Unsaved (copy)', study.document)
		library.abandon(study.id)
		await library.flush()
		expect(await disk(copy.id)).toMatchObject({ title: 'Unsaved (copy)' })
	})
	it('does not advance timestamps/revision for identical document and title', async () => {
		const study = await library.create('Amos', document)
		expect((await library.save(study, 1)).study).toEqual(study)
	})
	it('flush and close wait for queued saves', async () => {
		const study = await library.create('Amos', document)
		const pending = library.save({ ...study, title: 'Final' }, 1)
		await library.close()
		await pending
		expect(await disk(study.id)).toMatchObject({ title: 'Final', revision: 1 })
	})
	it('never overwrites a newer queued snapshot with an older sequence', async () => {
		const study = await library.create('Amos', document)
		const saves = [
			library.save({ ...study, title: 'Old' }, 1),
			library.save({ ...study, title: 'Newest' }, 3),
			library.save({ ...study, title: 'Stale' }, 2),
		]
		await Promise.all(saves)
		await library.flush()
		expect(await disk(study.id)).toMatchObject({ title: 'Newest', revision: 1 })
		await library.save({ ...study, title: 'Late stale' }, 1)
		expect(await disk(study.id)).toMatchObject({ title: 'Newest', revision: 1 })
	})
	it('accepts overlapping own writes from an older renderer baseline', async () => {
		await library.close()
		let started = () => {}
		let resume = () => {}
		const writing = new Promise<void>((resolve) => {
			started = resolve
		})
		const gate = new Promise<void>((resolve) => {
			resume = resolve
		})
		let pause = false
		library = await new Library(
			join(root, 'library'),
			join(root, 'private'),
			async (path, content) => {
				if (pause && path.endsWith('.study.json')) {
					pause = false
					started()
					await gate
				}
				await atomicWrite(path, content)
			},
		).initialize(false)
		const study = await library.create('Initial', document)
		pause = true
		const first = library.save({ ...study, title: 'First edit' }, 1, JSON.stringify(study))
		await writing
		const second = library.save({ ...study, title: 'Latest edit' }, 2, JSON.stringify(study))
		resume()
		expect((await first).conflict).toBe(false)
		expect((await second).conflict).toBe(false)
		expect(await disk(study.id)).toMatchObject({ title: 'Latest edit', revision: 2 })
	})
	it('rejects flush when staged edits have not been saved', async () => {
		const study = await library.create('Initial', document)
		library.stage({ ...study, title: 'Not yet saved' }, 1)
		await expect(library.flush()).rejects.toThrow('Unsaved document changes')
		await library.save({ ...study, title: 'Not yet saved' }, 1)
		await expect(library.flush()).resolves.toBeUndefined()
	})
	it('permits a new renderer sequence after reopening a study', async () => {
		let study = await library.create('Initial', document)
		study = (await library.save({ ...study, title: 'Old renderer' }, 100)).study
		await library.open(study.id)
		await library.save({ ...study, title: 'New renderer' }, 1)
		expect(await disk(study.id)).toMatchObject({ title: 'New renderer', revision: 2 })
	})
	it('does not report an authoritative save as failed when only the rebuildable index fails', async () => {
		await library.close()
		let indexFails = false
		library = await new Library(
			join(root, 'library'),
			join(root, 'private'),
			async (path, content) => {
				if (indexFails && path.endsWith('library.json')) throw new Error('Index unavailable')
				await atomicWrite(path, content)
			},
		).initialize(false)
		const study = await library.create('Initial', document)
		indexFails = true
		expect((await library.save({ ...study, title: 'Saved' }, 1)).study.revision).toBe(1)
		expect(await disk(study.id)).toMatchObject({ title: 'Saved', revision: 1 })
	})

	it('leaves malformed and unsupported files untouched, excluding them from the index', async () => {
		const study = await library.create('Amos', document)
		const newer = JSON.stringify({ ...study, schemaVersion: 7 })
		await writeFile(library.file(study.id), newer)
		await expect(library.open(study.id)).rejects.toBeInstanceOf(UnsupportedStudyVersion)
		expect(await library.list()).toEqual([])
		expect(await readFile(library.file(study.id), 'utf8')).toBe(newer)
		await writeFile(library.file(study.id), '{broken')
		await expect(library.open(study.id)).rejects.toThrow()
		expect(await library.list()).toEqual([])
	})
	it('rejects invalid page metadata and files containing a different ID', async () => {
		const study = await library.create('Amos', document)
		expect(() =>
			migrateStudy({
				...study,
				document: {
					...document,
					store: {
						'page:page': { ...document.store['page:page'], meta: { schemaVersion: 2, tags: [] } },
					},
				},
			}),
		).toThrow()
		await writeFile(
			library.file(study.id),
			JSON.stringify({ ...study, id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }),
		)
		await expect(library.open(study.id)).rejects.toThrow('filename')
	})
	it('reloads a valid external replacement and recognizes own writes by revision and hash', async () => {
		const study = await library.create('Amos', document)
		await library.externalChange(study.id)
		expect(events.filter((event) => event.kind === 'reload')).toHaveLength(0)
		const external = { ...study, title: 'External', revision: 10 }
		await atomicWrite(library.file(study.id), JSON.stringify(external))
		await library.externalChange(study.id)
		expect(events).toContainEqual({ kind: 'reload', study: external })
	})
	it('keeps invalid external replacements in memory and prevents replacing them on save', async () => {
		const study = await library.create('Amos', document)
		await writeFile(library.file(study.id), 'broken')
		await library.externalChange(study.id)
		expect(events.some((event) => event.kind === 'error')).toBe(true)
		await expect(library.save({ ...study, title: 'Local' }, 1)).rejects.toThrow()
		expect(await readFile(library.file(study.id), 'utf8')).toBe('broken')
	})
	it('keeps an externally deleted study in memory without silently recreating its file', async () => {
		const study = await library.create('Amos', document)
		await rm(library.file(study.id))
		await library.externalChange(study.id)
		expect(events).toContainEqual({ kind: 'deleted', studyId: study.id })
		await expect(library.save({ ...study, title: 'Local' }, 1)).rejects.toThrow(
			'deleted externally',
		)
		await expect(readFile(library.file(study.id))).rejects.toThrow()
	})
	it('preserves dirty edits in a new conflict copy while leaving the external original intact', async () => {
		const study = await library.create('Amos', document)
		library.stage({ ...study, title: 'Local' }, 1)
		const external = { ...study, title: 'External', revision: 2 }
		await atomicWrite(library.file(study.id), JSON.stringify(external))
		await library.externalChange(study.id)
		const conflict = events.find((event) => event.kind === 'conflict')
		expect(conflict?.kind).toBe('conflict')
		if (conflict?.kind !== 'conflict') throw new Error('Missing conflict event')
		expect(conflict.study.id).not.toBe(study.id)
		expect(await disk(conflict.study.id)).toMatchObject({ title: 'Local (conflict copy)' })
		await library.save({ ...study, title: 'Local' }, 1)
		expect(await disk(study.id)).toEqual(external)
	})
	it('detects same-revision content conflicts before replacing a file without relying on the watcher', async () => {
		const study = await library.create('Amos', document)
		const external = { ...study, title: 'External' }
		await writeFile(library.file(study.id), JSON.stringify(external))
		const saved = await library.save({ ...study, title: 'Local' }, 1)
		expect(saved.conflict).toBe(true)
		expect(await disk(study.id)).toEqual(external)
	})
	it('detects a stale renderer baseline even after the watcher has accepted the external revision', async () => {
		const study = await library.create('Before', document)
		await atomicWrite(library.file(study.id), JSON.stringify({ ...study, title: 'External' }))
		await library.externalChange(study.id)
		const saved = await library.save({ ...study, title: 'Late local' }, 5, JSON.stringify(study))
		expect(saved.conflict).toBe(true)
		expect(await disk(study.id)).toMatchObject({ title: 'External' })
	})
	it('retains only the latest twenty valid previous versions in private storage', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		try {
			let study = await library.create('Amos', document)
			for (let index = 1; index <= 25; index++) {
				vi.setSystemTime(Date.now() + 5 * 60 * 1000)
				study = (await library.save({ ...study, title: `Revision ${index}` }, index)).study
			}
			const folder = join(root, 'private', 'recovery', study.id)
			expect(await readdir(folder)).toHaveLength(20)
			expect(await library.latestRecovery(study.id)).toMatchObject({ revision: 24 })
		} finally {
			vi.useRealTimers()
		}
	})
	it('snapshots at most once per five minutes, and always on the first save after opening', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		try {
			const folder = join(root, 'private', 'recovery')
			let study = await library.create('Amos', document)
			const versions = async () => (await readdir(join(folder, study.id))).length
			study = (await library.save({ ...study, title: 'One' }, 1)).study
			expect(await versions()).toBe(1)
			for (let sequence = 2; sequence <= 4; sequence++) {
				vi.setSystemTime(Date.now() + 60 * 1000)
				study = (await library.save({ ...study, title: `Burst ${sequence}` }, sequence)).study
			}
			expect(await versions()).toBe(1)
			vi.setSystemTime(Date.now() + 2 * 60 * 1000)
			study = (await library.save({ ...study, title: 'Five minutes' }, 10)).study
			expect(await versions()).toBe(2)
			await library.open(study.id)
			study = (await library.save({ ...study, title: 'Reopened' }, 11)).study
			expect(await versions()).toBe(3)
		} finally {
			vi.useRealTimers()
		}
	})
	it('snapshots before an external reload even inside the throttle window', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		try {
			const study = await library.create('Amos', document)
			await library.save({ ...study, title: 'Local' }, 1)
			const folder = join(root, 'private', 'recovery', study.id)
			expect(await readdir(folder)).toHaveLength(1)
			const external = { ...(await disk(study.id)), title: 'External', revision: 10 }
			await atomicWrite(library.file(study.id), JSON.stringify(external))
			await library.externalChange(study.id)
			expect(events).toContainEqual({ kind: 'reload', study: external })
			expect(await readdir(folder)).toHaveLength(2)
			expect(await library.latestRecovery(study.id)).toMatchObject({ title: 'Local', revision: 1 })
		} finally {
			vi.useRealTimers()
		}
	})
	it('snapshots the previous disk version before a conflict copy, inside the throttle window', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		try {
			const study = await library.create('Amos', document)
			await library.save({ ...study, title: 'Saved' }, 1)
			const folder = join(root, 'private', 'recovery', study.id)
			const before = (await readdir(folder)).length
			library.stage({ ...study, title: 'Dirty' }, 2)
			const external = { ...study, title: 'External', revision: 9 }
			await atomicWrite(library.file(study.id), JSON.stringify(external))
			await library.externalChange(study.id)
			expect(events.some((event) => event.kind === 'conflict')).toBe(true)
			expect(await readdir(folder)).toHaveLength(before + 1)
		} finally {
			vi.useRealTimers()
		}
	})
	it('offers a newer valid recovery on open, ignoring corrupt recovery versions', async () => {
		const study = await library.create('Amos', document)
		const folder = join(root, 'private', 'recovery', study.id)
		await mkdir(folder, { recursive: true })
		await writeFile(
			join(folder, 'new.json'),
			JSON.stringify({ ...study, title: 'Recovered', revision: 5 }),
		)
		await writeFile(join(folder, 'corrupt.json'), '{')
		expect(await library.open(study.id)).toEqual(study)
		expect(events).toContainEqual({
			kind: 'recovery',
			study: { ...study, title: 'Recovered', revision: 5 },
		})
	})
	it('opens a library held by another live owner read-only', async () => {
		const other = await new Library(library.path, join(root, 'private-2')).initialize(false)
		try {
			expect(other.readOnly).toBe(true)
			await expect(other.create('Forbidden', document)).rejects.toThrow('read-only')
		} finally {
			await other.close()
		}
	})
	it('watches real atomic replacement events', async () => {
		await library.close()
		library = await new Library(join(root, 'library'), join(root, 'private')).initialize(true)
		library.onEvent = (event) => events.push(event)
		const study = await library.create('Amos', document)
		// Wait for chokidar's initial directory scan before testing notifications.
		await new Promise((resolve) => setTimeout(resolve, 200))
		await atomicWrite(library.file(study.id), JSON.stringify({ ...study, title: 'Watched' }))
		await expect
			.poll(
				() => events.some((event) => event.kind === 'reload' && event.study.title === 'Watched'),
				{ timeout: 3000 },
			)
			.toBe(true)
	})
	it('reports a stale lock from another host and replaces it only when taken over', async () => {
		await library.close()
		const lockPath = join(library.path, '.margin-lock')
		const acquiredAt = '2026-10-01T10:00:00.000Z'
		await writeFile(lockPath, JSON.stringify({ pid: 4242, hostname: 'studio-mac', acquiredAt }))
		library = await new Library(join(root, 'library'), join(root, 'private')).initialize(false)
		library.onEvent = (event) => events.push(event)
		expect(library.readOnly).toBe(true)
		expect(library.lockOwner).toEqual({ pid: 4242, hostname: 'studio-mac', acquiredAt })
		await expect(library.create('Forbidden', document)).rejects.toThrow('read-only')
		await library.takeOver()
		expect(library.readOnly).toBe(false)
		expect(library.lockOwner).toBeNull()
		expect(JSON.parse(await readFile(lockPath, 'utf8'))).toMatchObject({ hostname: hostname() })
		await library.create('Allowed', document)
		await library.close()
		await expect(readFile(lockPath, 'utf8')).rejects.toThrow()
	})
	it('never takes over a live lock held on this host', async () => {
		await library.close()
		const lockPath = join(library.path, '.margin-lock')
		await writeFile(
			lockPath,
			JSON.stringify({
				pid: process.pid,
				hostname: hostname(),
				acquiredAt: new Date().toISOString(),
			}),
		)
		library = await new Library(join(root, 'library'), join(root, 'private')).initialize(false)
		expect(library.readOnly).toBe(true)
		expect(library.lockOwner).toMatchObject({ hostname: hostname() })
		await expect(library.takeOver()).rejects.toThrow('not locked by another computer')
		expect(JSON.parse(await readFile(lockPath, 'utf8'))).toMatchObject({ pid: process.pid })
	})
	it('reclaims a dead lock from this host without a takeover', async () => {
		await library.close()
		await writeFile(
			join(library.path, '.margin-lock'),
			JSON.stringify({ pid: 2147483640, hostname: hostname() }),
		)
		library = await new Library(join(root, 'library'), join(root, 'private')).initialize(false)
		expect(library.readOnly).toBe(false)
	})
})
