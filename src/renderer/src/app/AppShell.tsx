import { useValue } from 'tldraw'
import { StudyWorkspace } from '../study/StudyWorkspace'
import { useStudySession, renameStudy, retrySave, saveCopy, createStudy } from '../study/session'
import { TitleBar } from './TitleBar'
import { LibraryLockNotice } from './LibraryLockNotice'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { EmptyHint } from './EmptyHint'
import { setActiveEditor, useEditorStore } from './editorStore'
import { useUiStore } from './uiStore'

export function AppShell() {
	const studyState = useStudySession()
	const session = studyState.currentId ? studyState.sessions[studyState.currentId] : undefined
	const editor = useEditorStore((state) => state.editor)
	const sidebarOpen = useUiStore((state) => state.sidebarOpen)
	const isEmpty = useValue(
		'empty study',
		() => !editor || editor.getCurrentPageShapeIds().size === 0,
		[editor],
	)
	return (
		<div className="app-shell">
			<TitleBar
				title={session?.study.title ?? 'Margin'}
				onRename={session && !studyState.readOnly && !studyState.closing ? renameStudy : undefined}
				onRetry={retrySave}
				onSaveCopy={() => void saveCopy()}
				saveState={session?.state}
			/>
			{studyState.lock && <LibraryLockNotice lock={studyState.lock} />}
			<div className="workspace">
				{sidebarOpen && <Sidebar onCreateStudy={() => void createStudy()} editor={editor} />}
				<main className="canvas-area" aria-label="Study canvas">
					<StudyWorkspace onEditor={setActiveEditor} />
					{session && isEmpty && <EmptyHint />}
					{session && <Toolbar editor={editor} />}
				</main>
			</div>
		</div>
	)
}
