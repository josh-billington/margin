import { useEffect, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { Preferences } from '@shared/ipc/contract'

// One shared copy, so a change in Settings reaches every reader (e.g. the insertion dialog).
let current: Preferences | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const publish = (next: Preferences) => {
	current = next
	for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}
const load = () =>
	(loading ??= window.margin.prefs
		.get()
		.then((result) => {
			if (result.ok) publish(result.data)
			else {
				loading = null
				toast.error(result.error.message)
			}
		})
		.catch(() => {
			loading = null
			toast.error("Margin couldn't load your settings. Try again.")
		}))

/** Saves a preference change and shares the result with every reader. */
export async function updatePrefs(patch: Partial<Preferences>) {
	try {
		const result = await window.margin.prefs.set(patch)
		if (result.ok) publish(result.data)
		else toast.error(result.error.message)
		return result.ok
	} catch {
		toast.error("Margin couldn't save your settings. Try again.")
		return false
	}
}

/** App preferences from the main process. `prefs` is null until the first read completes. */
export function usePrefs() {
	const prefs = useSyncExternalStore(subscribe, () => current)
	useEffect(() => void load(), [])
	return { prefs, update: updatePrefs }
}
