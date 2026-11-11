import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTLStore, getSnapshot, type Editor } from 'tldraw'
import type * as TldrawModule from 'tldraw'
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
import { flushBeforeClose, flushStudies, handleLibraryEvent, openStudy, saveCopy } from './session'

vi.mock('./editor', () => ({
	attachEditor: vi.fn(),
	snapshot: (editor: Editor) => getSnapshot(editor.store).document,
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
		listStudies: vi.fn(async () => success([])),
		createStudy: vi.fn(async () => success(makeStudy('Copy', copyId))),
		closeStudy: vi.fn(async () => success(null)),
		openStudy: vi.fn(async () => success(makeStudy('Second', copyId))),
		saveStudy: vi.fn(),
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
