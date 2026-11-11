import type { Editor } from 'tldraw'

/** history:ignore alone still emits source:user; remote scope also excludes autosave listeners. */
export function derived(editor: Editor, update: () => void) {
	editor.store.mergeRemoteChanges(() => editor.run(update, { history: 'ignore' }))
}
