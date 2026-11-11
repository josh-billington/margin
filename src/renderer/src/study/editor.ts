import { getSnapshot, loadSnapshot, type Editor } from 'tldraw'
import { studyFileEnvelopeSchema } from '@shared/study/types'
import type { TldrawDocumentSnapshot } from '@shared/study/types'
import type { PersistedStudy } from '@shared/study/migrations'
import { Autosave } from './autosave'
import { limitStudyHistory } from './history'
import {
	useStudySession,
	setBootstrap,
	editors,
	autosaves,
	pendingDocumentChanges,
	unwrap,
	report,
	update,
} from './state'
export const snapshot = (editor: Editor) =>
	studyFileEnvelopeSchema.shape.document.parse(getSnapshot(editor.store).document)
export function attachEditor(
	id: string | null,
	editor: Editor,
	save: () => Promise<void>,
	changed: () => void,
) {
	if (!id) {
		setBootstrap(editor)
		return
	}
	setBootstrap(null)
	const session = useStudySession.getState().sessions[id]
	if (!session) return
	try {
		loadSnapshot(editor.store, studySnapshot(session.study, editor))
	} catch (error) {
		update(id, { state: 'error', blocked: true })
		editor.updateInstanceState({ isReadonly: true })
		report(error)
		return
	}
	editor.clearHistory()
	editor.updateInstanceState({ isReadonly: useStudySession.getState().readOnly })
	editors.set(id, editor)
	autosaves.set(id, new Autosave(save))
	const historyEdited = limitStudyHistory(editor)
	const edited = () => {
		historyEdited()
		pendingDocumentChanges.add(id)
	}
	for (const type of editor.store.scopedTypes.document) {
		editor.disposables.add(
			editor.sideEffects.registerAfterCreateHandler(type, (_record, source) => {
				if (source === 'user') edited()
			}),
		)
		editor.disposables.add(
			editor.sideEffects.registerAfterChangeHandler(type, (_before, _after, source) => {
				if (source === 'user') edited()
			}),
		)
		editor.disposables.add(
			editor.sideEffects.registerAfterDeleteHandler(type, (_record, source) => {
				if (source === 'user') edited()
			}),
		)
	}
	editor.disposables.add(editor.store.listen(changed, { source: 'user', scope: 'document' }))
	void window.margin.camera
		.get({ studyId: id })
		.then((result) => {
			const camera = unwrap(result)
			if (camera) editor.setCamera(camera)
		})
		.catch(report)
	let cameraTimer: ReturnType<typeof setTimeout> | undefined
	editor.disposables.add(
		editor.store.listen(
			() => {
				clearTimeout(cameraTimer)
				cameraTimer = setTimeout(() => {
					const { x, y, z } = editor.getCamera()
					void window.margin.camera
						.set({ studyId: id, camera: { x, y, z } })
						.then(unwrap)
						.catch(report)
				}, 300)
			},
			{ scope: 'session' },
		),
	)
	editor.disposables.add(() => clearTimeout(cameraTimer))
}
// SDK loadSnapshot validates/migrates registered custom records before displaying a file.
export function studySnapshot(study: PersistedStudy, editor: Editor) {
	// JSON validation cannot reconstruct SDK-branded record IDs; validate with the registered SDK schema below.
	const snapshot = study.document as unknown as TldrawDocumentSnapshot
	const migrated = editor.store.schema.migrateStoreSnapshot(snapshot)
	if (migrated.type === 'error')
		throw new Error(`Cannot migrate this study's canvas: ${migrated.reason}`)
	for (const record of Object.values(migrated.value))
		editor.store.schema.validateRecord(editor.store, record, 'initialize', null)
	return snapshot
}
