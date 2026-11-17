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
		else toast.error(result.error.message)
	} catch {
		toast.error('Margin couldn’t load your settings. Try again.')
	}
}
export async function setPreferences(change: Partial<Notes>) {
	usePreferences.setState(change)
	try {
		const result = await window.margin.prefs.set(change)
		if (result.ok) usePreferences.setState(result.data)
		else toast.error(result.error.message)
	} catch {
		toast.error('Margin couldn’t save your settings. Try again.')
	}
}

/** Settings’ one “Note font” choice, stored as the two existing note preferences. */
export type NoteFontChoice = 'handwritten' | 'system-new' | 'system-all'
export function noteFontChoice(
	prefs: Pick<Notes, 'defaultNoteFont' | 'displayNotesInPlainFont'>,
): NoteFontChoice {
	if (prefs.displayNotesInPlainFont) return 'system-all'
	return prefs.defaultNoteFont === 'plain' ? 'system-new' : 'handwritten'
}
/**
 * “System for all notes” only changes how notes are shown, so each note keeps its own font and a
 * later switch back shows it as written.
 */
export function noteFontPreferences(
	choice: NoteFontChoice,
): Partial<Pick<Notes, 'defaultNoteFont' | 'displayNotesInPlainFont'>> {
	switch (choice) {
		case 'handwritten':
			return { defaultNoteFont: 'handwritten', displayNotesInPlainFont: false }
		case 'system-new':
			return { defaultNoteFont: 'plain', displayNotesInPlainFont: false }
		case 'system-all':
			return { displayNotesInPlainFont: true }
	}
}
