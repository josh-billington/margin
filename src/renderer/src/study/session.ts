import { validateLoadedAnnotations } from '../canvas/annotations/recovery'
import { loadSnapshot, type Editor } from 'tldraw'
import { toast } from 'sonner'
import type { PersistedStudy } from '@shared/study/migrations'
import type { LibraryEvent } from '@shared/ipc/contract'
import { attachEditor, snapshot, studySnapshot } from './editor'
import {
	useStudySession,
	editors,
	autosaves,
	pendingDocumentChanges,
	getBootstrap,
	current,
	update,
	unwrap,
	report,
	install,
	nextSequence,
} from './state'
export { useStudySession } from './state'

export async function refreshStudies() {
	useStudySession.setState({ studies: unwrap(await window.margin.library.listStudies()) })
}
export async function initializeStudies() {
	try {
		const library = unwrap(await window.margin.library.getLibrary())
		useStudySession.setState({
			setup: library?.setup ?? 'done',
			libraryPath: library?.path ?? '',
			libraryFolder: library?.folder ?? null,
			readOnly: library?.readOnly ?? true,
			lock: library?.lock ?? null,
			ready: true,
		})
		if (library?.setup === 'done' && library.readOnly && !library.lock)
			toast.info('This library is open read-only in another Margin process.')
		await refreshStudies()
		await ensureStudyOpen()
	} catch (error) {
		report(error)
	}
}
let opening: Promise<void> | null = null
/**
 * Launch behavior: land on a canvas. Reopen the last study (else the most recently updated one);
 * with an empty library silently create "Untitled study".
 */
export function ensureStudyOpen() {
	opening ??= openInitialStudy().finally(() => {
		opening = null
	})
	return opening
}
async function openInitialStudy() {
	const state = useStudySession.getState()
	if (state.setup !== 'done' || state.currentId || state.closing) return
	const last = await window.margin.prefs.get()
	const lastId = last.ok ? last.data.lastOpenedStudyId : undefined
	const recent = [...state.studies].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
	const pick = state.studies.find((study) => study.id === lastId) ?? recent
	if (pick) return openStudy(pick.id)
	if (state.readOnly) return
	// createStudy clones the schema from a mounted canvas; wait for the first one.
	for (let waited = 0; !getBootstrap() && editors.size === 0 && waited < 5000; waited += 50)
		await new Promise((resolve) => setTimeout(resolve, 50))
	await createStudy()
}
export async function completeSetup() {
	unwrap(await window.margin.library.completeSetup())
	await initializeStudies()
}
export async function flushStudies() {
	try {
		for (const id of pendingDocumentChanges) changed(id)
		for (const [id, session] of Object.entries(useStudySession.getState().sessions)) {
			if (session.state === 'error')
				throw new Error('Save failed. Retry or save a copy before closing or switching studies.')
			await autosaves.get(id)?.flush()
			if (useStudySession.getState().sessions[id]?.state === 'unsaved') await save(id)
		}
		for (const [studyId, editor] of editors) {
			const { x, y, z } = editor.getCamera()
			unwrap(await window.margin.camera.set({ studyId, camera: { x, y, z } }))
		}
		unwrap(await window.margin.library.flush())
		return true
	} catch (error) {
		report(error)
		return false
	}
}
export async function flushBeforeClose() {
	useStudySession.setState({ closing: true })
	for (const editor of editors.values()) editor.updateInstanceState({ isReadonly: true })
	const ok = await flushStudies()
	if (!ok) {
		useStudySession.setState({ closing: false })
		for (const editor of editors.values())
			editor.updateInstanceState({ isReadonly: useStudySession.getState().readOnly })
	}
	return ok
}
export async function openStudy(id: string) {
	if (
		useStudySession.getState().closing ||
		id === useStudySession.getState().currentId ||
		!(await flushStudies())
	)
		return
	try {
		const existing = useStudySession.getState().sessions[id]
		if (existing) useStudySession.setState({ currentId: id })
		else install(unwrap(await window.margin.library.openStudy({ studyId: id })))
	} catch (error) {
		report(error)
	}
}
export async function createStudy() {
	if (useStudySession.getState().closing || useStudySession.getState().readOnly) return
	if (!(await flushStudies())) return
	const editor = getBootstrap() ?? editors.values().next().value
	if (!editor) return
	try {
		const document = snapshot(editor)
		// New studies share the registered SDK schema, never another study's shapes.
		document.store = Object.fromEntries(
			Object.entries(document.store).filter(
				([, record]) =>
					record &&
					typeof record === 'object' &&
					!Array.isArray(record) &&
					(record.typeName === 'document' ||
						record.typeName === 'page' ||
						record.typeName === 'user'),
			),
		)
		for (const record of Object.values(document.store)) {
			if (
				record &&
				typeof record === 'object' &&
				!Array.isArray(record) &&
				record.typeName === 'page'
			)
				record.meta = { schemaVersion: 1, tags: [] }
		}
		install(unwrap(await window.margin.library.createStudy({ title: 'Untitled study', document })))
		await refreshStudies()
	} catch (error) {
		report(error)
	}
}
async function save(id: string) {
	const session = useStudySession.getState().sessions[id]
	if (!session || session.state === 'saved') return
	if (session.blocked)
		throw new Error('This file changed or was deleted. Save a copy or close the study.')
	update(id, { state: 'saving' })
	try {
		const result = unwrap(
			await window.margin.library.saveStudy({
				study: session.study,
				sequence: session.sequence,
				base: session.base,
			}),
		)
		if (result.conflict) {
			await conflict(result.study, id)
		} else {
			const latest = useStudySession.getState().sessions[id]
			if (latest)
				update(id, {
					base: JSON.stringify(result.study),
					study: {
						...latest.study,
						revision: result.study.revision,
						updatedAt: result.study.updatedAt,
					},
					state: latest.sequence === session.sequence ? 'saved' : 'unsaved',
				})
		}
		await refreshStudies().catch(report)
	} catch (error) {
		update(id, { state: 'error' })
		report(error)
		throw error
	}
}
function changed(id: string) {
	pendingDocumentChanges.delete(id)
	const session = useStudySession.getState().sessions[id]
	const editor = editors.get(id)
	if (!session || !editor || useStudySession.getState().readOnly) return
	const study = { ...session.study, document: snapshot(editor) }
	const next = nextSequence()
	update(id, { study, sequence: next, state: session.blocked ? 'error' : 'unsaved' })
	void window.margin.library
		.stageStudy({ study, sequence: next })
		.then((result) => {
			if (!result.ok) {
				update(id, { state: 'error' })
				report(result.error.message)
			}
		})
		.catch(report)
	if (!session.blocked) autosaves.get(id)?.schedule()
}
export function attachStudyEditor(id: string | null, editor: Editor) {
	attachEditor(
		id,
		editor,
		() => {
			if (id) return save(id)
			return Promise.resolve()
		},
		() => {
			if (id) changed(id)
		},
	)
}
export function renameStudy(title: string) {
	const session = current()
	if (
		!session ||
		!title.trim() ||
		title.trim() === session.study.title ||
		useStudySession.getState().readOnly ||
		useStudySession.getState().closing
	)
		return
	const id = session.study.id
	update(id, {
		study: { ...session.study, title: title.trim() },
		sequence: nextSequence(),
		state: 'unsaved',
	})
	const updated = useStudySession.getState().sessions[id]
	if (updated)
		void window.margin.library
			.stageStudy({ study: updated.study, sequence: updated.sequence })
			.catch(report)
	autosaves.get(id)?.schedule()
}
export function retrySave() {
	const session = current()
	if (session) {
		if (session.blocked) {
			report('Save a copy to preserve this study after an external change.')
			return
		}
		update(session.study.id, { state: 'unsaved' })
		void save(session.study.id).catch(() => {})
	}
}
export async function saveCopy() {
	const session = current()
	if (!session) return
	const editor = editors.get(session.study.id)
	editor?.updateInstanceState({ isReadonly: true })
	try {
		const copy = unwrap(
			await window.margin.library.createStudy({
				title: `${session.study.title} (copy)`,
				document: editor ? snapshot(editor) : session.study.document,
			}),
		)
		autosaves.get(session.study.id)?.cancel()
		closeMissing(session.study.id)
		install(copy)
		await refreshStudies()
	} catch (error) {
		report(error)
	} finally {
		editor?.updateInstanceState({ isReadonly: useStudySession.getState().readOnly })
	}
}
export async function deleteStudy(id: string) {
	if (!(await flushStudies())) return
	try {
		unwrap(await window.margin.library.deleteStudy({ studyId: id }))
		autosaves.get(id)?.cancel()
		autosaves.delete(id)
		editors.delete(id)
		useStudySession.setState((state) => {
			const sessions = { ...state.sessions }
			delete sessions[id]
			return { sessions, currentId: state.currentId === id ? null : state.currentId }
		})
		await refreshStudies()
		await ensureStudyOpen()
	} catch (error) {
		report(error)
	}
}
export async function chooseLibrary() {
	if (!(await flushStudies())) return
	try {
		const result = unwrap(await window.margin.library.chooseLibraryFolder())
		if (result) {
			for (const autosave of autosaves.values()) autosave.cancel()
			autosaves.clear()
			editors.clear()
			useStudySession.setState({
				sessions: {},
				currentId: null,
				setup: result.setup,
				libraryPath: result.path,
				libraryFolder: result.folder,
				readOnly: result.readOnly,
				lock: result.lock,
			})
			await refreshStudies()
			await ensureStudyOpen()
		}
	} catch (error) {
		report(error)
	}
}
export async function takeOverLibrary() {
	try {
		const library = unwrap(await window.margin.library.takeOver())
		useStudySession.setState({ readOnly: library.readOnly, lock: library.lock })
		for (const editor of editors.values())
			editor.updateInstanceState({ isReadonly: library.readOnly })
		await refreshStudies()
		toast.success('Library unlocked. This computer can now save.')
	} catch (error) {
		report(error)
	}
}
function reload(study: PersistedStudy) {
	const existingEditor = editors.get(study.id)
	if (existingEditor) {
		try {
			studySnapshot(study, existingEditor)
		} catch (error) {
			update(study.id, { state: 'error', blocked: true })
			throw error
		}
	}
	autosaves.get(study.id)?.cancel()
	const editor = editors.get(study.id)
	if (editor) {
		const camera = editor.getCamera()
		loadSnapshot(editor.store, studySnapshot(study, editor))
		editor.clearHistory()
		editor.selectNone()
		editor.setCamera(camera)
		// Externally changed text may no longer match highlights/arrows (SPEC §7.4).
		validateLoadedAnnotations(editor)
	}
	pendingDocumentChanges.delete(study.id)
	update(study.id, { study, base: JSON.stringify(study), state: 'saved', blocked: false })
}
async function externalReload(study: PersistedStudy) {
	const session = useStudySession.getState().sessions[study.id]
	const editor = editors.get(study.id)
	// A user edit may precede the watcher's notification but still be waiting for
	// the store listener's next frame / IPC stage message. Preserve it here too.
	if (session && (pendingDocumentChanges.has(study.id) || session.state !== 'saved')) {
		editor?.updateInstanceState({ isReadonly: true })
		try {
			const copy = unwrap(
				await window.margin.library.createStudy({
					title: `${session.study.title} (conflict copy)`,
					document: editor ? snapshot(editor) : session.study.document,
				}),
			)
			reload(study)
			install(copy)
			await refreshStudies()
			toast.warning('Your latest edits were preserved in a conflict copy.')
		} catch (error) {
			update(study.id, { state: 'error', blocked: true })
			throw error
		} finally {
			editor?.updateInstanceState({ isReadonly: useStudySession.getState().readOnly })
		}
	} else reload(study)
}

const conflictTasks = new Map<string, Promise<void>>()
function conflict(copy: PersistedStudy, originalId: string): Promise<void> {
	const existing = conflictTasks.get(copy.id)
	if (existing) return existing
	const task = applyConflict(copy, originalId)
	conflictTasks.set(copy.id, task)
	return task
}
async function applyConflict(copy: PersistedStudy, originalId: string) {
	autosaves.get(originalId)?.cancel()
	const editor = editors.get(originalId)
	editor?.updateInstanceState({ isReadonly: true })
	const local = useStudySession.getState().sessions[originalId]
	const latestDocument = editor ? snapshot(editor) : local?.study.document
	let preferredCopy = copy
	if (local && latestDocument && JSON.stringify(latestDocument) !== JSON.stringify(copy.document)) {
		const latestCopy = unwrap(
			await window.margin.library.createStudy({
				title: `${local.study.title} (conflict copy)`,
				document: latestDocument,
			}),
		)
		preferredCopy = latestCopy
	}

	const original = unwrap(await window.margin.library.openStudy({ studyId: originalId }))
	reload(original)
	if (!useStudySession.getState().sessions[copy.id]) {
		const currentId = useStudySession.getState().currentId
		install(copy)
		if (currentId && currentId !== originalId) useStudySession.setState({ currentId })
	}
	if (preferredCopy.id !== copy.id) install(preferredCopy)
	editor?.updateInstanceState({ isReadonly: useStudySession.getState().readOnly })
	toast.warning('External changes were kept. Your edits are in a conflict copy.')
}
export function handleLibraryEvent(event: LibraryEvent) {
	return (async () => {
		switch (event.kind) {
			case 'list':
				await refreshStudies()
				break
			case 'reload':
				await externalReload(event.study)
				toast.info('Study reloaded after an external change. Undo history was reset.')
				break
			case 'conflict':
				await conflict(event.study, event.originalId)
				await refreshStudies()
				break
			case 'deleted':
				autosaves.get(event.studyId)?.cancel()
				update(event.studyId, { state: 'error', blocked: true })
				toast.warning('This study was deleted outside Margin.', {
					action: {
						label: 'Save a copy',
						onClick: () => {
							useStudySession.setState({ currentId: event.studyId })
							void saveCopy()
						},
					},
					cancel: { label: 'Close', onClick: () => closeMissing(event.studyId) },
				})
				break
			case 'error':
				autosaves.get(event.studyId)?.cancel()
				update(event.studyId, { state: 'error', blocked: true })
				toast.error(event.message)
				break
			case 'recovery':
				toast.info('A newer recovery version is available.', {
					action: {
						label: 'Save recovery copy',
						onClick: () => {
							void window.margin.library
								.createStudy({
									title: `${event.study.title} (recovered)`,
									document: event.study.document,
								})
								.then((result) => {
									install(unwrap(result))
									return refreshStudies()
								})
								.catch(report)
						},
					},
				})
				break
		}
	})().catch(report)
}
function closeMissing(id: string) {
	void window.margin.library.closeStudy({ studyId: id }).catch(report)
	pendingDocumentChanges.delete(id)
	autosaves.get(id)?.cancel()
	autosaves.delete(id)
	editors.delete(id)
	useStudySession.setState((state) => {
		const sessions = { ...state.sessions }
		delete sessions[id]
		return { sessions, currentId: state.currentId === id ? null : state.currentId }
	})
}
