import { create } from 'zustand'
import { toast } from 'sonner'
import type { Preferences } from '@shared/ipc/contract'

type Notes = Pick<Preferences, 'defaultNoteFont' | 'displayNotesInPlainFont' | 'highlightColor'>
// Defaults apply until the main-process preferences load.
export const usePreferences = create<Notes>(() => ({
	defaultNoteFont: 'handwritten',
	displayNotesInPlainFont: false,
}))

export async function loadPreferences() {
	try {
		const result = await window.margin.prefs.get()
		if (result.ok) usePreferences.setState(result.data)
	} catch {
		// Keep defaults; preferences are non-critical.
	}
}
export async function setPreferences(change: Partial<Notes>) {
	usePreferences.setState(change)
	try {
		const result = await window.margin.prefs.set(change)
		if (result.ok) usePreferences.setState(result.data)
		else toast.error(result.error.message)
	} catch (error) {
		toast.error(error instanceof Error ? error.message : String(error))
	}
}
