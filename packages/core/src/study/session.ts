import { validateLoadedAnnotations } from '../canvas/annotations/recovery'
import { loadSnapshot, type Editor } from 'tldraw'
import { toast } from 'sonner'
import { UserFacingError } from '@shared/errors'
import { documentVersion, type PersistedStudy } from '@shared/study/migrations'
import { STUDY_SCHEMA_VERSION } from '@shared/study/types'
import type { LibraryEvent } from '@shared/ipc/contract'
import { attachEditor, snapshot, studySnapshot } from './editor'
import { Autosave } from './autosave'
import { untitledTitle } from './untitled'
import {
	useStudySession,
	editors,
	autosaves,
	stagings,
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
		if (library?.error) toast.error(library.error, { id: 'library-startup', duration: Infinity })
		else toast.dismiss('library-startup')
		if (library?.setup === 'done' && library.readOnly && !library.lock)
			toast.info('Another copy of Margin has this library open. Close it to save changes here.')
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
	const last = await window.margin.prefs.get().catch((error: unknown) => {
		report(error)
		return null
	})
	const lastId = last?.ok ? last.data.lastOpenedStudyId : undefined
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
// Edits are marked dirty immediately; the whole-document snapshot and IPC stage run at most this often.
const STAGING_MS = 250
export async function flushStudies() {
	try {
		const staged = await Promise.allSettled([
			...[...pendingDocumentChanges].map(stage),
			...[...stagings.values()].map((staging) => staging.flush()),
		])
		for (const result of staged) if (result.status === 'rejected') throw result.reason
		for (const [id, session] of Object.entries(useStudySession.getState().sessions)) {
			if (session.state === 'error')
				throw new UserFacingError(
					'Margin couldn’t save your changes. Try again or save a copy before closing or switching studies.',
				)
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
export async function flushBeforeClose(reason: 'checkpoint' | 'close' = 'close') {
	if (reason === 'checkpoint') return flushStudies()
	useStudySession.setState({ closing: true })
	for (const editor of editors.values()) editor.updateInstanceState({ isReadonly: true })
	const ok = await flushStudies()
	if (pendingDocumentChanges.size) return false
	const dirty = Object.values(useStudySession.getState().sessions)
		.filter((session) => session.state !== 'saved')
		.map(({ study, sequence }) => ({ studyId: study.id, sequence }))
	return ok && !dirty.length ? true : { dirty }
}
let navigation = 0
const openTasks = new Map<string, Promise<PersistedStudy>>()
export async function openStudy(id: string) {
	const request = ++navigation
	if (useStudySession.getState().closing || id === useStudySession.getState().currentId) return
	if (!(await flushStudies())) return
	try {
		if (!useStudySession.getState().sessions[id]) {
			let task = openTasks.get(id)
			if (!task) {
				task = window.margin.library.openStudy({ studyId: id }).then(unwrap)
				openTasks.set(id, task)
			}
			let study: PersistedStudy
			try {
				study = await task
			} finally {
				if (openTasks.get(id) === task) openTasks.delete(id)
			}
			if (request !== navigation || useStudySession.getState().closing) return
			if (!useStudySession.getState().sessions[id]) install(study)
		}
		if (request === navigation && !useStudySession.getState().closing)
			useStudySession.setState({ currentId: id })
	} catch (error) {
		report(error)
	}
}
let creating = false
export async function createStudy() {
	if (creating) return
	creating = true
	try {
		await createStudyNow()
	} finally {
		creating = false
	}
}
async function createStudyNow() {
	if (useStudySession.getState().closing || useStudySession.getState().readOnly) return
	if (!(await flushStudies())) return
	const editor = getBootstrap() ?? editors.values().next().value
	if (!editor) return
	try {
		const document = snapshot(editor)
		// New studies share the registered SDK schema, never another study's shapes.
		// The snapshot shares records with the open study's store: build new page records, never edit them.
		document.store = Object.fromEntries(
			Object.entries(document.store).flatMap(([key, record]) => {
				if (!record || typeof record !== 'object' || Array.isArray(record)) return []
				if (record.typeName === 'page')
					return [[key, { ...record, meta: { schemaVersion: 1, tags: [] } }]]
				return record.typeName === 'document' || record.typeName === 'user' ? [[key, record]] : []
			}),
		)
		const title = untitledTitle(useStudySession.getState().studies.map((study) => study.title))
		install(unwrap(await window.margin.library.createStudy({ title, document })))
		await refreshStudies()
	} catch (error) {
		report(error)
	}
}
async function save(id: string) {
	await stage(id)
	await stagings.get(id)?.flush()
	const session = useStudySession.getState().sessions[id]
	if (!session || session.state === 'saved') return
	if (session.blocked)
		throw new UserFacingError(
			'This study changed outside Margin or its file is missing. Save a copy or close the study.',
		)
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
async function stage(id: string) {
	if (!pendingDocumentChanges.has(id)) return
	const session = useStudySession.getState().sessions[id]
	const editor = editors.get(id)
	if (!session || !editor || useStudySession.getState().readOnly) return
	const study = withCurrentDocument(session.study, editor)
	pendingDocumentChanges.delete(id)
	update(id, { study })
	try {
		unwrap(await window.margin.library.stageStudy({ study, sequence: session.sequence }))
	} catch (error) {
		pendingDocumentChanges.add(id)
		update(id, { state: 'error' })
		report(error)
		throw error
	}
}
function withCurrentDocument(study: PersistedStudy, editor: Editor) {
	const document = snapshot(editor)
	const required =
		study.schemaVersion === STUDY_SCHEMA_VERSION ? STUDY_SCHEMA_VERSION : documentVersion(document)
	const schemaVersion = required > study.schemaVersion ? required : study.schemaVersion
	return { ...study, schemaVersion, document }
}
function changed(id: string) {
	const session = useStudySession.getState().sessions[id]
	if (!session || useStudySession.getState().readOnly) return
	pendingDocumentChanges.add(id)
	update(id, { sequence: nextSequence(), state: session.blocked ? 'error' : 'unsaved' })
	stagings.get(id)?.schedule()
	if (!session.blocked) autosaves.get(id)?.schedule()
}
export function attachStudyEditor(id: string | null, editor: Editor) {
	if (id) {
		stagings.get(id)?.cancel()
		const staging = new Autosave(() => stage(id), STAGING_MS, STAGING_MS)
		stagings.set(id, staging)
		editor.disposables.add(() => {
			staging.cancel()
			if (stagings.get(id) === staging) stagings.delete(id)
		})
	}
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
	const editor = editors.get(id)
	update(id, {
		study: {
			...(editor ? withCurrentDocument(session.study, editor) : session.study),
			title: title.trim(),
		},
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
			report('This study changed outside Margin. Save a copy to keep your edits.')
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
		await stage(session.study.id)
		await stagings.get(session.study.id)?.flush()
		const copy = unwrap(
			await window.margin.library.createStudy({
				title: `${session.study.title} (copy)`,
				document: editor ? snapshot(editor) : session.study.document,
			}),
		)
		autosaves.get(session.study.id)?.cancel()
		await closeMissing(session.study.id)
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
		stagings.get(id)?.cancel()
		stagings.delete(id)
		pendingDocumentChanges.delete(id)
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
			navigation++
			openTasks.clear()
			for (const autosave of autosaves.values()) autosave.cancel()
			autosaves.clear()
			for (const staging of stagings.values()) staging.cancel()
			stagings.clear()
			pendingDocumentChanges.clear()
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
		if (!(await flushStudies())) return
		await refreshStudies()
		toast.success('Margin can now save changes to this library.')
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
	stagings.get(study.id)?.cancel()
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
			toast.warning('This study changed outside Margin. Your edits are saved in a conflict copy.')
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
	const task = applyConflict(copy, originalId).catch((error: unknown) => {
		conflictTasks.delete(copy.id)
		throw error
	})
	conflictTasks.set(copy.id, task)
	return task
}
async function applyConflict(copy: PersistedStudy, originalId: string) {
	autosaves.get(originalId)?.cancel()
	const editor = editors.get(originalId)
	editor?.updateInstanceState({ isReadonly: true })
	try {
		const local = useStudySession.getState().sessions[originalId]
		const latestDocument = editor ? snapshot(editor) : local?.study.document
		let preferredCopy = copy
		if (
			local &&
			latestDocument &&
			JSON.stringify(latestDocument) !== JSON.stringify(copy.document)
		) {
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
		toast.warning('This study changed outside Margin. Your edits are saved in a conflict copy.')
	} catch (error) {
		update(originalId, { state: 'error', blocked: true })
		throw error
	} finally {
		const { readOnly, closing } = useStudySession.getState()
		editor?.updateInstanceState({ isReadonly: readOnly || closing })
	}
}
export function handleLibraryEvent(event: LibraryEvent) {
	return (async () => {
		switch (event.kind) {
			case 'keep-open':
				useStudySession.setState({ closing: false })
				for (const editor of editors.values())
					editor.updateInstanceState({ isReadonly: useStudySession.getState().readOnly })
				break
			case 'list':
				await refreshStudies()
				break
			case 'reload':
				await externalReload(event.study)
				toast.info(
					'Margin reloaded this study after a change outside the app. You can no longer undo earlier edits.',
				)
				break
			case 'conflict':
				await conflict(event.study, event.originalId)
				await refreshStudies()
				break
			case 'deleted':
				autosaves.get(event.studyId)?.cancel()
				update(event.studyId, { state: 'error', blocked: true })
				toast.warning(
					'Margin can no longer find this study’s file. Save a copy or close the study.',
					{
						action: {
							label: 'Save a copy',
							onClick: () => {
								useStudySession.setState({ currentId: event.studyId })
								void saveCopy()
							},
						},
						cancel: {
							label: 'Close',
							onClick: () => {
								void closeMissing(event.studyId).catch(report)
							},
						},
					},
				)
				break
			case 'error':
				autosaves.get(event.studyId)?.cancel()
				update(event.studyId, { state: 'error', blocked: true })
				toast.error(event.message)
				break
			case 'recovery':
				toast.info('Margin found a newer recovery copy of this study.', {
					action: {
						label: 'Save the recovery copy',
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
async function closeMissing(id: string) {
	unwrap(await window.margin.library.closeStudy({ studyId: id }))
	pendingDocumentChanges.delete(id)
	stagings.get(id)?.cancel()
	stagings.delete(id)
	autosaves.get(id)?.cancel()
	autosaves.delete(id)
	editors.delete(id)
	useStudySession.setState((state) => {
		const sessions = { ...state.sessions }
		delete sessions[id]
		return { sessions, currentId: state.currentId === id ? null : state.currentId }
	})
}
