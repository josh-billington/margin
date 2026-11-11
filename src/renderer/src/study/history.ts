interface HistoryControls {
	undo(): unknown
	redo(): unknown
	clearHistory(): unknown
	getCanUndo(): boolean
	getCanRedo(): boolean
	markHistoryStoppingPoint(name?: string): string
}

// Use public editor methods. The SDK has no public API for pruning its internal
// stack; this bounds available document transactions without reading that stack.
export function limitStudyHistory(editor: HistoryControls, limit = 1000) {
	const undo = editor.undo.bind(editor)
	const redo = editor.redo.bind(editor)
	const clear = editor.clearHistory.bind(editor)
	const mark = editor.markHistoryStoppingPoint.bind(editor)
	const canUndo = editor.getCanUndo.bind(editor)
	const canRedo = editor.getCanRedo.bind(editor)
	let available = 0
	let pending = false
	let replaying = false
	const commit = () => {
		if (pending) available = Math.min(limit, available + 1)
		pending = false
	}
	editor.markHistoryStoppingPoint = (name) => {
		commit()
		return mark(name)
	}
	editor.getCanUndo = () => (available > 0 || pending) && canUndo()
	editor.undo = () => {
		commit()
		if (available === 0 || !canUndo()) return editor
		replaying = true
		try {
			undo()
			available--
		} finally {
			replaying = false
		}
		return editor
	}
	editor.redo = () => {
		if (!canRedo()) return editor
		replaying = true
		try {
			redo()
			available = Math.min(limit, available + 1)
		} finally {
			replaying = false
		}
		return editor
	}
	editor.clearHistory = () => {
		available = 0
		pending = false
		clear()
		return editor
	}
	return () => {
		if (!replaying) pending = true
	}
}
