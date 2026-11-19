import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type * as ChokidarModule from 'chokidar'
import { watch } from 'chokidar'
import { Library, type LibraryEvent } from './library'
import { atomicWrite } from './atomic'
import * as logger from '../logger'

const readiness = vi.hoisted(() => new Map<object, Promise<void>>())
vi.mock('chokidar', async (original) => {
	const actual = await original<typeof ChokidarModule>()
	return {
		...actual,
		watch: vi.fn((...args: Parameters<typeof actual.watch>) => {
			const watcher = actual.watch(...args)
			readiness.set(watcher, new Promise<void>((resolve) => watcher.once('ready', resolve)))
			return watcher
		}),
	}
})
let root: string
let library: Library | undefined
afterEach(async () => {
	await library?.close().catch(() => {})
	if (root) await rm(root, { recursive: true, force: true })
	vi.restoreAllMocks()
})
it('reports watcher errors, retries once and keeps staged edits', async () => {
	root = await mkdtemp(join(tmpdir(), 'margin-watch-'))
	const logged = vi.spyOn(logger, 'logFailure')
	library = await new Library(root, join(root, 'private')).initialize()
	const events: LibraryEvent[] = []
	library.onEvent = (event) => events.push(event)
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
	const study = await library.create('Original', document)
	library.stage({ ...study, title: 'Staged edits' }, 1)
	const first = vi.mocked(watch).mock.results[0]!.value
	await readiness.get(first)
	const error = Object.assign(new Error('Too many watchers'), { code: 'EMFILE' })
	expect(() => first.emit('error', error)).not.toThrow()
	await expect.poll(() => vi.mocked(watch).mock.results.length).toBe(2)
	expect(logged).toHaveBeenCalledWith('library-watcher-failed', error)
	expect(events).toContainEqual({
		kind: 'error',
		studyId: '',
		message: expect.stringContaining('watch'),
	})
	expect([...library.stagedIds()]).toEqual([study.id])
	const second = vi.mocked(watch).mock.results[1]!.value
	await readiness.get(second)
	await atomicWrite(library.file(study.id), JSON.stringify({ ...study, title: 'External' }))
	await expect.poll(() => events.some((event) => event.kind === 'conflict')).toBe(true)
	expect(() => second.emit('error', error)).not.toThrow()
	await new Promise((resolve) => setImmediate(resolve))
	expect(watch).toHaveBeenCalledTimes(2)
})
