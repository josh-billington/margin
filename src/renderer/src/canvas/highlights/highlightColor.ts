import { usePreferences, setPreferences } from '../../lib/preferences'
import type { PaletteColor } from '@shared/study/types'

export const DEFAULT_HIGHLIGHT_COLOR: PaletteColor = 'amber'

/** The colour new plain highlights get; remembered in preferences. */
export const getHighlightColor = (): PaletteColor =>
	usePreferences.getState().highlightColor ?? DEFAULT_HIGHLIGHT_COLOR
export const setHighlightColor = (highlightColor: PaletteColor) =>
	void setPreferences({ highlightColor })
