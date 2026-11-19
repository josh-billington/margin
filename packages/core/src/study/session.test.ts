import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTLStore, type Editor } from 'tldraw'
import type * as TldrawModule from 'tldraw'
import { studyFileEnvelopeSchema } from '@shared/study/types'
import { migrateStudy } from '@shared/study/migrations'
import { Autosave } from './autosave'
import {
	autosaves,
	editors,
	install,
	pendingDocumentChanges,
	update,
	useStudySession,
} from './state'
import {
	chooseLibrary,
	flushBeforeClose,
	flushStudies,
	handleLibraryEvent,
	openStudy,
	renameStudy,
	saveCopy,
} from './session'

vi.mock('./editor', () => ({
	attachEditor: vi.fn(),
	snapshot: (editor: Editor) => editor.store.getStoreSnapshot(),
	studySnapshot: (study: ReturnType<typeof migrateStudy>) => study.document,
}))
vi.mock('tldraw', async (original) => ({
	...(await original<typeof TldrawModule>()),
	loadSnapshot: vi.fn(),
}))

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const copyId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const makeStudy = (title = 'Original', studyId = id) =>
	migrateStudy({
		format: 'margin-study',
		schemaVersion: 1,
		id: studyId,
		title,
		createdAt: '2026-11-02T00:00:00.000Z',
		updatedAt: '2026-11-02T00:00:00.000Z',
		revision: 0,
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
const success = <T>(data: T) => ({ ok: true as const, data })
const api = {
	library: {
		flush: vi.fn(async () => success(null)),
		chooseLibraryFolder: vi.fn(async () =>
			success({
				setup: 'pending' as const,
				path: '/new-library',
				folder: null,
				readOnly: false,
				lock: null,
			}),
		),
		listStudies: vi.fn(async () => success([])),
		createStudy: vi.fn(async () => success(makeStudy('Copy', copyId))),
		closeStudy: vi.fn(
			async (): Promise<
				{ ok: true; data: null } | { ok: false; error: { code: string; message: string } }
			> => success(null),
		),
		openStudy: vi.fn(async () => success(makeStudy('Second', copyId))),
		saveStudy: vi.fn(),
		stageStudy: vi.fn(async () => success(null)),
	},
	camera: { set: vi.fn(async () => success(null)) },
}
beforeEach(() => {
	vi.clearAllMocks()
	vi.stubGlobal('window', { margin: api })
	useStudySession.setState({
		currentId: null,
		sessions: {},
		studies: [],
		readOnly: false,
		closing: false,
	})
	install(makeStudy())
})
afterEach(() => {
	for (const autosave of autosaves.values()) autosave.cancel()
	autosaves.clear()
	editors.clear()
	pendingDocumentChanges.clear()
	vi.unstubAllGlobals()
})

describe('study session boundaries', () => {
	it('waits for pending autosave before acknowledging normal close', async () => {
		let finish = () => {}
		const saving = new Promise<void>((resolve) => {
			finish = resolve
		})
		update(id, { state: 'saving' })
		const autosave = new Autosave(async () => {
			await saving
			update(id, { state: 'saved' })
		})
		autosaves.set(id, autosave)
		autosave.schedule()
		let closed = false
		const closing = flushBeforeClose().then((ok) => {
			closed = ok
		})
		await Promise.resolve()
		expect(closed).toBe(false)
		finish()
		await closing
		expect(closed).toBe(true)
		expect(api.library.flush).toHaveBeenCalledTimes(1)
	})
	it('keeps the current study open and editable when close flush fails', async () => {
		update(id, { state: 'error' })
		expect(await flushBeforeClose()).toBe(false)
		expect(useStudySession.getState().currentId).toBe(id)
		expect(useStudySession.getState().closing).toBe(false)
		await openStudy(copyId)
		expect(useStudySession.getState().currentId).toBe(id)
		expect(api.library.openStudy).not.toHaveBeenCalled()
	})
	it('retains both opened sessions across study switches', async () => {
		install(makeStudy('Second', copyId))
		await openStudy(id)
		expect(useStudySession.getState().currentId).toBe(id)
		expect(Object.keys(useStudySession.getState().sessions)).toHaveLength(2)
		expect(api.library.openStudy).not.toHaveBeenCalled()
	})
	it('preserves a dirty renderer session when a clean main-process reload races its stage message', async () => {
		update(id, { study: makeStudy('Local edit'), state: 'unsaved' })
		await handleLibraryEvent({ kind: 'reload', study: makeStudy('External edit') })
		expect(api.library.createStudy).toHaveBeenCalledWith({
			title: 'Local edit (conflict copy)',
			document: makeStudy().document,
		})
		expect(useStudySession.getState().sessions[id]?.study.title).toBe('External edit')
		expect(useStudySession.getState().sessions[copyId]).toBeDefined()
	})
	it('keeps externally deleted content in memory and blocks flush until copied or closed', async () => {
		await handleLibraryEvent({ kind: 'deleted', studyId: id })
		expect(useStudySession.getState().sessions[id]?.study).toEqual(makeStudy())
		expect(await flushStudies()).toBe(false)
		await saveCopy()
		expect(api.library.createStudy).toHaveBeenCalledWith({
			title: 'Original (copy)',
			document: makeStudy().document,
		})
		expect(useStudySession.getState().currentId).toBe(copyId)
		expect(useStudySession.getState().sessions[id]).toBeUndefined()
	})
	it('keeps the old session until close IPC succeeds after saving a copy', async () => {
		let finish = () => {}
		const gate = new Promise<void>((resolve) => {
			finish = resolve
		})
		api.library.closeStudy.mockImplementationOnce(async () => {
			await gate
			return success(null)
		})
		const copying = saveCopy()
		await vi.waitFor(() => expect(api.library.closeStudy).toHaveBeenCalled())
		expect(useStudySession.getState().sessions[id]).toBeDefined()
		finish()
		await copying
		expect(useStudySession.getState().sessions[id]).toBeUndefined()
	})
	it('keeps the session when close IPC returns a failure', async () => {
		api.library.closeStudy.mockResolvedValueOnce({
			ok: false,
			error: { code: 'SAVE_FAILED', message: 'Try again.' },
		})
		await saveCopy()
		expect(useStudySession.getState().sessions[id]).toBeDefined()
		expect(useStudySession.getState().currentId).toBe(id)
	})
	it('preserves invalid external documents and marks them failed without replacing memory', async () => {
		await handleLibraryEvent({ kind: 'error', studyId: id, message: 'Malformed external file' })
		expect(useStudySession.getState().sessions[id]).toMatchObject({
			study: makeStudy(),
			state: 'error',
			blocked: true,
		})
	})
	it('resets editor history on a valid clean reload and preserves its camera', async () => {
		const store = createTLStore()
		const camera = { x: 10, y: 20, z: 0.5 }
		const editor = {
			store,
			clearHistory: vi.fn(),
			selectNone: vi.fn(),
			getCamera: () => camera,
			setCamera: vi.fn(),
		} as unknown as Editor
		editors.set(id, editor)
		await handleLibraryEvent({ kind: 'reload', study: makeStudy('External') })
		expect(editor.clearHistory).toHaveBeenCalledTimes(1)
		expect(editor.setCamera).toHaveBeenCalledWith(camera)
		expect(useStudySession.getState().sessions[id]?.state).toBe('saved')
	})
})

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => {
		resolve = done
	})
	return { promise, resolve }
}
async function settle() {
	for (let i = 0; i < 20; i++) await Promise.resolve()
}
it('deduplicates overlapping opens without replacing intervening edits', async () => {
	const response = deferred<ReturnType<typeof success<ReturnType<typeof makeStudy>>>>()
	api.library.openStudy.mockReturnValue(response.promise)
	const first = openStudy(copyId),
		second = openStudy(copyId)
	await settle()
	expect(api.library.openStudy).toHaveBeenCalledTimes(1)
	response.resolve(success(makeStudy('Second', copyId)))
	await first
	renameStudy('My edit')
	await second
	expect(useStudySession.getState().sessions[copyId]?.study.title).toBe('My edit')
})
it('keeps the latest navigation when opens finish in reverse order', async () => {
	const thirdId = '01ARZ3NDEKTSV4RRFFQ69G5FAX'
	const old = deferred<ReturnType<typeof success<ReturnType<typeof makeStudy>>>>()
	const latest = deferred<ReturnType<typeof success<ReturnType<typeof makeStudy>>>>()
	api.library.openStudy.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
	const first = openStudy(copyId),
		second = openStudy(thirdId)
	await settle()
	latest.resolve(success(makeStudy('Third', thirdId)))
	await second
	old.resolve(success(makeStudy('Second', copyId)))
	await first
	expect(useStudySession.getState().currentId).toBe(thirdId)
})
it('renames using the live editor document before its change notification', () => {
	const store = createTLStore()
	const document = store.getStoreSnapshot()
	editors.set(id, { store } as Editor)
	renameStudy('New title')
	expect(api.library.stageStudy).toHaveBeenCalledWith(
		expect.objectContaining({
			study: expect.objectContaining({ title: 'New title', document }),
		}),
	)
})
it('ignores an open response from the previous library', async () => {
	const response = deferred<ReturnType<typeof success<ReturnType<typeof makeStudy>>>>()
	api.library.openStudy.mockReturnValueOnce(response.promise)
	const opening = openStudy(copyId)
	await settle()
	await chooseLibrary()
	response.resolve(success(makeStudy('Old library', copyId)))
	await opening
	expect(useStudySession.getState().currentId).toBeNull()
	expect(useStudySession.getState().sessions).toEqual({})
})
it('does not reinstall a session created while its open request was pending', async () => {
	const response = deferred<ReturnType<typeof success<ReturnType<typeof makeStudy>>>>()
	api.library.openStudy.mockReturnValueOnce(response.promise)
	const opening = openStudy(copyId)
	await settle()
	install(makeStudy('Live session', copyId))
	update(copyId, { state: 'unsaved' })
	response.resolve(success(makeStudy('Old disk snapshot', copyId)))
	await opening
	expect(useStudySession.getState().sessions[copyId]).toMatchObject({
		study: { title: 'Live session' },
		state: 'unsaved',
	})
})
it('restores editing and retries conflict recovery after a bridge rejection', async () => {
	const editor = {
		store: createTLStore(),
		updateInstanceState: vi.fn(),
		getCamera: () => ({ x: 0, y: 0, z: 1 }),
		clearHistory: vi.fn(),
		selectNone: vi.fn(),
		setCamera: vi.fn(),
		getCurrentPageShapes: () => [],
	} as unknown as Editor
	editors.set(id, editor)
	// Keep the copy identical so this test exercises reopening the original.
	const copy = studyFileEnvelopeSchema.parse({
		...makeStudy('Copy', copyId),
		document: editor.store.getStoreSnapshot(),
	})
	api.library.openStudy.mockRejectedValueOnce(new Error('Disconnected'))
	const event = { kind: 'conflict' as const, originalId: id, study: copy }
	await handleLibraryEvent(event)
	expect(editor.updateInstanceState).toHaveBeenLastCalledWith({ isReadonly: false })
	api.library.openStudy.mockResolvedValueOnce(success(makeStudy()))
	await handleLibraryEvent(event)
	expect(api.library.openStudy).toHaveBeenCalledTimes(2)
	expect(useStudySession.getState().sessions[id]?.state).toBe('saved')
	expect(editor.updateInstanceState).toHaveBeenLastCalledWith({ isReadonly: false })
})
it('opens the recent study when reading the last-opened preference rejects', async () => {
	const { ensureStudyOpen } = await import('./session')
	api.library.openStudy.mockResolvedValueOnce(success(makeStudy('Recent', copyId)))
	vi.stubGlobal('window', {
		margin: { ...api, prefs: { get: vi.fn().mockRejectedValue(new Error('Disconnected')) } },
	})
	useStudySession.setState({
		setup: 'done',
		currentId: null,
		studies: [makeStudy('Recent', copyId)],
	})
	await ensureStudyOpen()
	expect(useStudySession.getState().currentId).toBe(copyId)
})
