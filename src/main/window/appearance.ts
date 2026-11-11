import { nativeTheme } from 'electron'
import type { Appearance } from '../../shared/ipc/contract'

/** Opaque window colors, matching --canvas-bg in tokens.css. */
const WINDOW_BACKGROUND = { dark: '#141115', light: '#f7f4f0' }
/** Native Liquid Glass tint (RRGGBBAA), matching the --glass-scrim hue. */
const GLASS_TINT = { dark: '#14111599', light: '#f7f4f099' }

export type ResolvedAppearance = 'light' | 'dark'

/** Makes system materials and prefers-color-scheme follow the preference; 'system' tracks macOS. */
export function applyAppearance(preference: Appearance | undefined) {
	nativeTheme.themeSource = preference ?? 'system'
}
export const resolvedAppearance = (): ResolvedAppearance =>
	nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
export const windowBackground = () => WINDOW_BACKGROUND[resolvedAppearance()]
export const glassTint = () => GLASS_TINT[resolvedAppearance()]
