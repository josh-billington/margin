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
 * Instead the indicator goes quiet while a save is ordinary, and speaks only when it means
 * something. It never says "Saved" before the data is on disk.
 */
export const SAVE_TIMING = {
	/** A single save still running this long is slow enough to mention (a busy or remote disk). */
	savingAfterMs: 1000,
	/** Unsaved this long without a save starting means autosave isn't keeping up. */
	unsavedAfterMs: 4000,
	/** "Saved" returns only once the study has stayed saved this long, so typing doesn't flash it. */
	savedAfterMs: 600,
}

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
			// After a visible message, confirm at once; after quiet autosave, wait so typing never flashes it.
			return now === 'quiet'
				? { show: 'quiet', later: { show: 'saved', afterMs: SAVE_TIMING.savedAfterMs } }
				: { show: 'saved' }
		case 'saving':
			// A retry after an error, or a slow save already on screen, keeps saying so.
			return now === 'saving' || now === 'error'
				? { show: 'saving' }
				: { show: 'quiet', later: { show: 'saving', afterMs: SAVE_TIMING.savingAfterMs } }
		case 'unsaved':
			if (now === 'unsaved') return { show: 'unsaved' }
			return {
				// Autosave queued behind a slow save is still saving, as far as the reader is concerned.
				show: now === 'saving' ? 'saving' : 'quiet',
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
	// The effect runs after paint; never let one frame say "Saved" while the state is not saved.
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
	// Quiet keeps "Saved" laid out but hidden, so nothing shifts and it can fade back in place.
	const { label, icon: Icon } = states[shown === 'quiet' ? 'saved' : shown]
	return (
		<span className="save-indicator" data-state={shown} role="status">
			{/* Saved ↔ quiet is a fade on one element; only a real change of message swaps it in. */}
			<span
				className="save-indicator-content"
				key={shown === 'quiet' ? 'saved' : shown}
				aria-hidden={shown === 'quiet' || undefined}
			>
				<Icon {...iconSm} aria-hidden="true" />
				{label}
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
