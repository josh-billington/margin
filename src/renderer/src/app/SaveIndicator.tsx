import { useEffect, useState } from 'react'
import { Check, Circle, LoaderCircle, TriangleAlert } from 'lucide-react'
import { iconSm } from '../lib/icons'

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'
const states = {
	saved: { label: 'Saved', icon: Check },
	saving: { label: 'Saving…', icon: LoaderCircle },
	unsaved: { label: 'Unsaved changes', icon: Circle },
	error: { label: 'Save failed', icon: TriangleAlert },
}

/** Fast saves never flash "Saving": it only shows once a save has been pending for a moment. */
const SAVING_DELAY_MS = 400

function useShownState(state: SaveState): SaveState {
	const [shown, setShown] = useState(state)
	useEffect(() => {
		if (state !== 'saving') return setShown(state)
		const timer = setTimeout(() => setShown(state), SAVING_DELAY_MS)
		return () => clearTimeout(timer)
	}, [state])
	return shown === 'saving' && state !== 'saving' ? state : shown
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
	const { label, icon: Icon } = states[shown]
	return (
		<span className="save-indicator" data-state={shown} role="status">
			<span className="save-indicator-content" key={shown}>
				<Icon {...iconSm} aria-hidden="true" />
				{label}
			</span>
			{shown === 'error' && (
				<>
					<button className="text-button" onClick={onRetry}>
						Retry
					</button>
					<button className="text-button" onClick={onSaveCopy}>
						Save a copy
					</button>
				</>
			)}
		</span>
	)
}
