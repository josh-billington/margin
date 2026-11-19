import { create } from 'zustand'
import type { Platform } from '@shared/ipc/contract'
import { updatePrefs } from '../lib/usePrefs'

/**
 * Whether the welcome intro is on screen. It opens at launch when the main process says it has not
 * played, and again from Help › Show Welcome. Platforms with their own welcome (iPad) never open it.
 */
export const useIntro = create<{ open: boolean }>(() => ({ open: false }))

let available = false

/** Called before the first render, so a first launch never paints the app before the intro. */
export function initializeIntro({ platform, atLaunch }: { platform: Platform; atLaunch: boolean }) {
	available = platform.welcomeIntro
	useIntro.setState({ open: available && atLaunch })
}

export const isIntroOpen = () => useIntro.getState().open

export function showIntro() {
	if (available) useIntro.setState({ open: true })
}

/** The intro is ending (skipped or finished): it has been seen, whatever happens next. */
export function markIntroSeen() {
	void updatePrefs({ introSeen: true })
}

/** The closing dissolve has finished; what the intro covered (first-run setup) can show. */
export function closeIntro() {
	useIntro.setState({ open: false })
}
