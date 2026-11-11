import { expect, it } from 'vitest'
import { limitStudyHistory } from './history'
it('retains the latest 1,000 document undo transactions and resets on external reload', () => {
	let native = 0
	let redos = 0
	const editor = {
		undo() {
			native--
			redos++
			edited()
		},
		redo() {
			native++
			redos--
			edited()
		},
		clearHistory() {
			native = 0
			redos = 0
		},
		getCanUndo() {
			return native > 0
		},
		getCanRedo() {
			return redos > 0
		},
		markHistoryStoppingPoint() {
			return 'mark'
		},
	}
	const edited = limitStudyHistory(editor)
	for (let i = 0; i < 1100; i++) {
		editor.markHistoryStoppingPoint()
		native++
		edited()
	}
	for (let i = 0; i < 1100; i++) editor.undo()
	expect(native).toBe(100)
	expect(editor.getCanUndo()).toBe(false)
	editor.redo()
	expect(editor.getCanUndo()).toBe(true)
	editor.undo()
	expect(editor.getCanUndo()).toBe(false)
	// Branching must not expose the truncated history again.
	editor.markHistoryStoppingPoint()
	native++
	edited()
	editor.undo()
	expect(native).toBe(100)
	expect(editor.getCanUndo()).toBe(false)
	editor.clearHistory()
	expect(editor.getCanUndo()).toBe(false)
})
it('groups document edits between native history stopping points', () => {
	let native = 0
	const editor = {
		undo() {
			native--
		},
		redo() {},
		clearHistory() {
			native = 0
		},
		getCanUndo: () => native > 0,
		getCanRedo: () => false,
		markHistoryStoppingPoint: () => 'mark',
	}
	const edited = limitStudyHistory(editor, 2)
	for (let i = 0; i < 5; i++) {
		editor.markHistoryStoppingPoint()
		native++
		edited()
		edited()
		edited()
	}
	editor.undo()
	editor.undo()
	editor.undo()
	expect(native).toBe(3)
})
it('never asks the SDK to undo past the cap, even after many more transactions', () => {
	// tldraw 5.6 keeps every undo entry on its own stack. Undo is capped here, not pruned.
	let native = 0
	let nativeUndos = 0
	const editor = {
		undo() {
			native--
			nativeUndos++
		},
		redo() {},
		clearHistory() {
			native = 0
		},
		getCanUndo: () => native > 0,
		getCanRedo: () => false,
		markHistoryStoppingPoint: () => 'mark',
	}
	const edited = limitStudyHistory(editor, 50)
	for (let i = 0; i < 5000; i++) {
		editor.markHistoryStoppingPoint()
		native++
		edited()
	}
	for (let i = 0; i < 200; i++) editor.undo()
	expect(nativeUndos).toBe(50)
	expect(native).toBe(4950)
})
