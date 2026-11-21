import { useSyncExternalStore } from 'react'
import { platformSchema } from '@shared/ipc/contract'

/** Capture the host's capabilities once, before the renderer mounts. */
export const platform = platformSchema.parse(window.margin.platform)

const coarsePointer = matchMedia('(pointer: coarse)')
const subscribeCoarsePointer = (listener: () => void) => {
	coarsePointer.addEventListener('change', listener)
	return () => coarsePointer.removeEventListener('change', listener)
}
/** A finger is the main pointer, so keyboard-only routes need a control on screen. */
export const useCoarsePointer = () =>
	useSyncExternalStore(subscribeCoarsePointer, () => coarsePointer.matches)
