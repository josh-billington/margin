import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createTLStore, PageRecordType, ZERO_INDEX_KEY, type Editor } from 'tldraw'
import { migrateStudy } from '@shared/study/migrations'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Library } from './library'
import { attachStudyEditor, flushBeforeClose, flushStudies, openStudy } from '@renderer/study/session'
import { autosaves, editors, install, pendingDocumentChanges, useStudySession } from '@renderer/study/state'

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const otherId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const success = <T>(data: T) => ({ ok: true as const, data })
const store = () => {
	const store = createTLStore()
	store.put([
		PageRecordType.create({
			name: 'Original',
			index: ZERO_INDEX_KEY,
			meta: { schemaVersion: 1, tags: [] },
		}),
	])
	return store
}
const study = () =>
	migrateStudy({
		format: 'margin-study',
		schemaVersion: 1,
		id,
		title: 'Study',
		revision: 0,
		createdAt: '2026-11-02T00:00:00.000Z',
		updatedAt: '2026-11-02T00:00:00.000Z',
		document: store().getStoreSnapshot(),
	})
let editor: Editor
let saved: ReturnType<typeof study>[]
let staged: ReturnType<typeof study>[]
beforeEach(() => {
	vi.useFakeTimers()
	saved = []
	staged = []
	useStudySession.setState({ sessions: {}, currentId: null, readOnly: false, closing: false })
	install(study())
	const canvasStore = store()
	editor = {
		store: canvasStore,
		sideEffects: canvasStore.sideEffects,
		disposables: new Set(),
		clearHistory() {},
		undo() {},
		redo() {},
		getCanUndo: () => false,
		getCanRedo: () => false,
		markHistoryStoppingPoint: () => '',
		updateInstanceState() {},
		getCamera: () => ({ x: 0, y: 0, z: 1 }),
	} as unknown as Editor
	vi.stubGlobal('window', {
		devicePixelRatio: 1,
		margin: {
			library: {
				stageStudy: vi.fn(async ({ study }: { study: ReturnType<typeof migrateStudy> }) => {
					staged.push(study)
					return success(null)
				}),
				saveStudy: vi.fn(async ({ study }: { study: ReturnType<typeof migrateStudy> }) => {
					saved.push(study)
					return success({ study, conflict: false })
				}),
				flush: vi.fn(async () => success(null)),
				listStudies: vi.fn(async () => success([])),
				openStudy: vi.fn(async () => success({ ...study(), id: otherId })),
			},
			camera: { get: vi.fn(async () => success(null)), set: vi.fn(async () => success(null)) },
		},
	})
	attachStudyEditor(id, editor)
})
afterEach(() => {
	for (const dispose of editor?.disposables ?? []) dispose()
	for (const autosave of autosaves.values()) autosave.cancel()
	autosaves.clear()
	editors.clear()
	pendingDocumentChanges.clear()
	vi.useRealTimers()
	vi.unstubAllGlobals()
})
function edit(name: string) {
	const page = editor.store.allRecords().find((record) => record.typeName === 'page')
	if (!page) throw new Error('Missing page')
	editor.store.put([{ ...page, name }])
}
const pageName = (study: ReturnType<typeof migrateStudy> | undefined) =>
	Object.values(study?.document.store ?? {}).find(
		(record) =>
			record && typeof record === 'object' && !Array.isArray(record) && record.typeName === 'page',
	)

it('marks dirty synchronously and coalesces snapshots without dropping the final edit', async () => {
	edit('First')
	expect(useStudySession.getState().sessions[id]?.state).toBe('unsaved')
	for (let i = 0; i < 10; i++) {
		await vi.advanceTimersByTimeAsync(10)
		edit(`Edit ${i}`)
	}
	await vi.advanceTimersByTimeAsync(200)
	expect(staged.length).toBeLessThan(5)
	expect(pageName(staged.at(-1))).toMatchObject({ name: 'Edit 9' })
	await vi.advanceTimersByTimeAsync(600)
	expect(pageName(saved.at(-1))).toMatchObject({ name: 'Edit 9' })
})
it.each(['close', 'switch', 'quit'] as const)(
	'%s flushes the latest edit before its staging timer',
	async (boundary) => {
		edit('Latest edit')
		const ok =
			boundary === 'switch'
				? await openStudy(otherId)
				: boundary === 'close'
					? await flushBeforeClose()
					: await flushStudies()
		expect(ok).not.toBe(false)
		expect(pageName(staged.at(-1))).toMatchObject({ name: 'Latest edit' })
		expect(pageName(saved.at(-1))).toMatchObject({ name: 'Latest edit' })
	},
)
it('stages recent edits for recovery even when the disk save fails', async () => {
	window.margin.library.saveStudy = vi.fn().mockRejectedValue(new Error('Disk full'))
	edit('Recovery edit')
	expect(await flushBeforeClose()).toBe(false)
	expect(pageName(staged.at(-1))).toMatchObject({ name: 'Recovery edit' })
})
it('keeps the final edit when another stage is still in flight', async () => {
	let finish = () => {}
	const gate = new Promise<void>((resolve) => {
		finish = resolve
	})
	const stage = window.margin.library.stageStudy
	window.margin.library.stageStudy = async (request) => {
		await gate
		return stage(request)
	}
	edit('First')
	await vi.advanceTimersByTimeAsync(100)
	edit('Final')
	const flushing = flushBeforeClose()
	finish()
	expect(await flushing).toBe(true)
	expect(pageName(saved.at(-1))).toMatchObject({ name: 'Final' })
	expect(pageName(staged.at(-1))).toMatchObject({ name: 'Final' })
})
it('writes recent staged edits into a crash-recovery snapshot before autosave', async () => {
	const root = await mkdtemp(join(tmpdir(), 'margin-staging-recovery-'))
	const library = await new Library(join(root, 'library'), join(root, 'private')).initialize(false)
	try {
		const initial = await library.create('Recovery', study().document)
		window.margin.library.stageStudy = async ({ study, sequence }) => {
			library.stage({ ...study, id: initial.id }, sequence)
			return success(null)
		}
		edit('Recent crash edit')
		await vi.advanceTimersByTimeAsync(300)
		expect(saved).toHaveLength(0)
		expect(await library.preserveUnsaved()).toEqual({ preserved: [initial.id], failed: [] })
		const recovery = await library.latestRecovery(initial.id)
		expect(pageName(recovery ?? undefined)).toMatchObject({ name: 'Recent crash edit' })
		library.abandon(initial.id)
	} finally {
		await library.close().catch(() => {})
		await rm(root, { recursive: true, force: true })
	}
})
