import { useEffect, useRef, useState } from 'react'
import { Check, Circle, LoaderCircle, TriangleAlert } from 'lucide-react'
import { iconSm } from '../lib/icons'

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'
/** What the title bar shows. 'quiet' is ordinary autosave in progress: no claim either way. */
export type ShownSaveState = SaveState | 'quiet'

const states = {
	saved: { label: 'Saved', icon: Check },
	saving: { label: 'Saving…', icon: LoaderCircle },
	unsaved: { label: 'Unsaved changes', icon: Circle },
	error: { label: 'Margin couldn’t save', icon: TriangleAlert },
}

/**
 * Autosave writes within about 2.5s of an edit (500ms debounce, 2s cap), so most changes are
 * pending for a moment and then saved. Narrating that would change the label on every keystroke.
 * Instead, while a save is ordinary, the title bar keeps showing the last "Saved", unchanged and
 * without a fade. The label changes only when something means it: a slow save, changes autosave
 * hasn't picked up, or an error. Once it has said any of those, it says "Saved" again only when
 * the study is on disk.
 */
export const SAVE_TIMING = {
	/** A single save still running this long is slow enough to mention (a busy or remote disk). */
	savingAfterMs: 1000,
	/** Unsaved this long without a save starting means autosave isn't keeping up. */
	unsavedAfterMs: 4000,
}

/** 'quiet' keeps showing the last "Saved"; it is only ever reached from "Saved". */
const showsSaved = (shown: ShownSaveState) => shown === 'saved' || shown === 'quiet'
/** The words on screen for what is shown. */
export const shownLabel = (shown: ShownSaveState) => states[shown === 'quiet' ? 'saved' : shown].label

/**
 * The next thing to show when the real state changes, given what is on screen now. Returns what to
 * show at once and, optionally, what to show after a delay if the state holds that long.
 */
export function nextShown(
	state: SaveState,
	now: ShownSaveState,
): { show: ShownSaveState; later?: { show: ShownSaveState; afterMs: number } } {
	switch (state) {
		case 'error':
			return { show: 'error' }
		case 'saved':
			return { show: 'saved' }
		case 'saving':
			// A save after a message on screen is progress worth showing; after "Saved" it is ordinary.
			return showsSaved(now)
				? { show: 'quiet', later: { show: 'saving', afterMs: SAVE_TIMING.savingAfterMs } }
				: { show: 'saving' }
		case 'unsaved':
			if (now === 'unsaved') return { show: 'unsaved' }
			return {
				// Autosave queued behind a slow save, or a retry after an error, is saving as far as the
				// reader is concerned: the error steps aside for progress, not for silence.
				show: showsSaved(now) ? 'quiet' : 'saving',
				later: { show: 'unsaved', afterMs: SAVE_TIMING.unsavedAfterMs },
			}
	}
}

function useShownState(state: SaveState): ShownSaveState {
	const [shown, setShown] = useState<ShownSaveState>(
		state === 'saved' || state === 'error' ? state : 'quiet',
	)
	const current = useRef(shown)
	useEffect(() => {
		current.current = shown
	})
	useEffect(() => {
		const { show, later } = nextShown(state, current.current)
		setShown(show)
		if (!later) return
		const timer = setTimeout(() => setShown(later.show), later.afterMs)
		return () => clearTimeout(timer)
	}, [state])
	// The effect runs after paint; for that frame a change of state reads as ordinary autosave.
	return shown === 'saved' && state !== 'saved' ? 'quiet' : shown
}

export function SaveIndicator({
	state,
	onRetry,
	onSaveCopy,
}: {
	state: SaveState
	onRetry?: () => void
	onSaveCopy?: () => void
}) {
	const shown = useShownState(state)
	const message = shown === 'quiet' ? 'saved' : shown
	const Icon = states[message].icon
	return (
		<span className="save-indicator" data-state={shown} role="status">
			{/* Keyed by the words, so ordinary autosave (quiet ↔ saved) changes nothing on screen. */}
			<span className="save-indicator-content" key={message}>
				<Icon {...iconSm} aria-hidden="true" />
				{shownLabel(shown)}
			</span>
			{shown === 'error' && (
				<>
					<button className="text-button" onClick={onRetry}>
						Try again
					</button>
					<button className="text-button" onClick={onSaveCopy}>
						Save a copy
					</button>
				</>
			)}
		</span>
	)
}
