import { useSyncExternalStore } from 'react'
import type { GlassMode, ResolvedAppearance } from '@shared/ipc/contract'

/**
 * Mirrors the window material onto <html data-glass>. CSS makes the title bar and sidebar
 * transparent only for 'native' / 'vibrancy'; otherwise they stay solid.
 */
export function syncGlassMode() {
	const apply = (mode: GlassMode) => {
		document.documentElement.dataset.glass = mode
	}
	apply(window.margin.glass.mode)
	return window.margin.glass.onChange(apply)
}

/** Tracks the last input device on <html data-input> so keyboard-driven surfaces can skip motion. */
export function trackInputModality() {
	const set = (value: 'keyboard' | 'pointer') => () => {
		document.documentElement.dataset.input = value
	}
	const onKey = set('keyboard'),
		onPointer = set('pointer')
	window.addEventListener('keydown', onKey, true)
	window.addEventListener('pointerdown', onPointer, true)
	return () => {
		window.removeEventListener('keydown', onKey, true)
		window.removeEventListener('pointerdown', onPointer, true)
	}
}

let appearance: ResolvedAppearance = window.margin.appearance.mode
const appearanceListeners = new Set<() => void>()

/** Mirrors the resolved appearance (preference + system, decided in main) onto <html data-appearance>. */
export function syncAppearance() {
	const apply = (mode: ResolvedAppearance) => {
		appearance = mode
		document.documentElement.dataset.appearance = mode
		for (const listener of appearanceListeners) listener()
	}
	apply(appearance)
	return window.margin.appearance.onChange(apply)
}

const subscribeAppearance = (listener: () => void) => {
	appearanceListeners.add(listener)
	return () => appearanceListeners.delete(listener)
}
export const useAppearance = () => useSyncExternalStore(subscribeAppearance, () => appearance)
