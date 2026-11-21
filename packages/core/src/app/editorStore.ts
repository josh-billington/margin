import { create } from 'zustand'
import type { Editor } from 'tldraw'

/** The tldraw editor of the study currently on screen (null while none is mounted). */
export const useEditorStore = create<{ editor: Editor | null }>(() => ({ editor: null }))
export const setActiveEditor = (editor: Editor | null) => useEditorStore.setState({ editor })
export const getActiveEditor = () => useEditorStore.getState().editor
