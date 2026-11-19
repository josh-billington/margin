import { useEffect, useState } from 'react'
import type { Editor } from 'tldraw'
import { MarginCanvas } from '../canvas/MarginCanvas'
import { attachStudyEditor, useStudySession } from './session'

// Keep the Editor as well as its store alive: tldraw's undo manager belongs to Editor.
export function StudyWorkspace({ onEditor }: { onEditor: (editor: Editor | null) => void }) {
	const currentId = useStudySession((state) => state.currentId)
	const sessions = useStudySession((state) => state.sessions)
	const [editors, setEditors] = useState<Record<string, Editor>>({})
	useEffect(() => {
		for (const [id, editor] of Object.entries(editors)) {
			if (id !== currentId) editor.blur()
			if (id === currentId) editor.selectNone()
		}
		onEditor(currentId ? (editors[currentId] ?? null) : null)
	}, [currentId, editors, onEditor])
	useEffect(() => {
		setEditors((previous) => {
			const retained = Object.fromEntries(Object.entries(previous).filter(([id]) => sessions[id]))
			return Object.keys(retained).length === Object.keys(previous).length ? previous : retained
		})
	}, [sessions])
	return (
		<>
			{Object.keys(sessions).length === 0 && (
				<div style={{ position: 'absolute', inset: 0, visibility: 'hidden' }} aria-hidden="true">
					<MarginCanvas onMount={(editor) => attachStudyEditor(null, editor)} />
				</div>
			)}
			{Object.keys(sessions).map((id) => (
				<div
					key={id}
					style={{
						position: 'absolute',
						inset: 0,
						visibility: currentId === id ? 'visible' : 'hidden',
						pointerEvents: currentId === id ? 'auto' : 'none',
					}}
					aria-hidden={currentId !== id}
				>
					<MarginCanvas
						onMount={(editor) => {
							attachStudyEditor(id, editor)
							setEditors((previous) => ({ ...previous, [id]: editor }))
						}}
					/>
				</div>
			))}
		</>
	)
}
