import { create } from 'zustand'
import type { Editor } from 'tldraw'
import { toast } from 'sonner'
import type { PersistedStudy } from '@shared/study/migrations'
import type { LockNotice, StudySummary } from '@shared/ipc/contract'
import type { SaveState } from '../app/SaveIndicator'
import type { Autosave } from './autosave'
type Session = {
	base: string
	study: PersistedStudy
	state: SaveState
	sequence: number
	blocked: boolean
}
interface StudyState {
	currentId: string | null
	studies: StudySummary[]
	sessions: Record<string, Session>
	readOnly: boolean
	/** Another computer holds the library lock; the reader may take it over. */
	lock: LockNotice | null
	ready: boolean
	closing: boolean
}
export const useStudySession = create<StudyState>(() => ({
	currentId: null,
	studies: [],
	sessions: {},
	readOnly: false,
	lock: null,
	ready: false,
	closing: false,
}))
export const editors = new Map<string, Editor>()
export const pendingDocumentChanges = new Set<string>()
export const autosaves = new Map<string, Autosave>()
let bootstrap: Editor | null = null
let sequence = 0
export const nextSequence = () => ++sequence
export const getBootstrap = () => bootstrap
export const setBootstrap = (editor: Editor | null) => {
	bootstrap = editor
}
export const current = () => {
	const state = useStudySession.getState()
	return state.currentId ? state.sessions[state.currentId] : undefined
}
export function update(id: string, change: Partial<Session>) {
	useStudySession.setState((state) => {
		const session = state.sessions[id]
		return session ? { sessions: { ...state.sessions, [id]: { ...session, ...change } } } : {}
	})
}
export function unwrap<T>(
	result: { ok: true; data: T } | { ok: false; error: { message: string } },
): T {
	if (!result.ok) throw new Error(result.error.message)
	return result.data
}
export function report(error: unknown) {
	toast.error(error instanceof Error ? error.message : String(error))
}
export function install(study: PersistedStudy) {
	useStudySession.setState((state) => ({
		currentId: study.id,
		sessions: {
			...state.sessions,
			[study.id]: {
				study,
				base: JSON.stringify(study),
				state: 'saved',
				sequence: nextSequence(),
				blocked: false,
			},
		},
	}))
}
