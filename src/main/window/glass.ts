import { nativeTheme } from 'electron'
import type { BrowserWindow } from 'electron'
import { release } from 'node:os'
import type liquidGlassDefault from 'electron-liquid-glass'
import { GLASS_CHANNEL } from '../../shared/ipc/contract'
import type { GlassMode } from '../../shared/ipc/contract'
import { glassTint, resolvedAppearance } from './appearance'

/** Darwin 25 is macOS 26, the first release with NSGlassEffectView. */
const supportsLiquidGlass = () =>
	process.platform === 'darwin' && Number.parseInt(release(), 10) >= 25

/**
 * The window material to start with. `enabled` is the persisted preference; MARGIN_GLASS=0 always wins.
 * With 'none' the window is opaque and the chrome is solid.
 */
export function resolveGlassMode(enabled: boolean | undefined): GlassMode {
	if (process.platform !== 'darwin' || process.env.MARGIN_GLASS === '0' || enabled === false)
		return 'none'
	if (nativeTheme.prefersReducedTransparency) return 'none'
	return supportsLiquidGlass() ? 'native' : 'vibrancy'
}

type LiquidGlass = typeof liquidGlassDefault

/**
 * Native Liquid Glass (macOS 26) behind the title bar and sidebar, or Electron's public vibrancy
 * before that. The glass view fills the whole window; only the transparent chrome in the renderer
 * lets it show, while the canvas stays opaque. Any failure degrades to solid chrome.
 */
export function attachGlass(window: BrowserWindow, initial: GlassMode): void {
	if (initial === 'none') return
	/** The material that actually works; Reduce Transparency hides it without removing it. */
	let material: GlassMode = initial
	const publish = (mode: GlassMode) => {
		if (!window.isDestroyed() && !window.webContents.isDestroyed())
			window.webContents.send(GLASS_CHANNEL, mode)
	}
	let glassModule: LiquidGlass | null = null
	let tintedFor = resolvedAppearance()
	const addGlass = (glass: LiquidGlass) =>
		glass.addView(window.getNativeWindowHandle(), {
			cornerRadius: 0,
			tintColor: glassTint(),
			opaque: false,
		})
	const applyVibrancy = () => {
		try {
			window.setVibrancy('sidebar')
			return true
		} catch {
			return false
		}
	}
	window.webContents.once('did-finish-load', () => {
		if (material === 'native') {
			try {
				// Optional native module, loaded lazily so a load failure cannot break startup.
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				const glass = require('electron-liquid-glass') as LiquidGlass
				tintedFor = resolvedAppearance()
				if (addGlass(glass) < 0) throw new Error('Liquid Glass is unavailable')
				glassModule = glass
				return
			} catch (error) {
				console.error('Liquid Glass failed; falling back to vibrancy.', error)
				material = applyVibrancy() ? 'vibrancy' : 'none'
				publish(material)
			}
		} else if (!applyVibrancy()) {
			material = 'none'
			publish(material)
		}
	})
	const onThemeChange = () => {
		if (window.isDestroyed()) return
		// The native view has no tint setter; adding a view replaces the previous one.
		if (glassModule && tintedFor !== resolvedAppearance()) {
			tintedFor = resolvedAppearance()
			try {
				addGlass(glassModule)
			} catch (error) {
				console.error('Liquid Glass retint failed.', error)
			}
		}
		if (nativeTheme.prefersReducedTransparency) {
			if (material === 'vibrancy') window.setVibrancy(null)
			publish('none')
		} else {
			if (material === 'vibrancy') applyVibrancy()
			publish(material)
		}
	}
	nativeTheme.on('updated', onThemeChange)
	window.on('closed', () => nativeTheme.removeListener('updated', onThemeChange))
}
