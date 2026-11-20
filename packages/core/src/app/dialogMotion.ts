import { useState } from 'react'

/** How a dialog appears or leaves: `instant` skips its scale and its overlay's fade. */
export type DialogMotion = 'instant' | 'animated'

let handingOff = false
let lastInput: 'keyboard' | 'pointer' = 'pointer'

/** The device the reader used last, kept up to date by trackInputModality (glass.ts). */
export function noteInput(input: 'keyboard' | 'pointer') {
	lastInput = input
}

/**
 * Runs a palette command that may open a dialog in the palette's place. The palette leaves and the
 * dialog arrives in the same frame under one unbroken dim; cross-fading two overlays would let the
 * canvas brighten between them. Cleared on the next frame, after React has rendered both.
 */
export function handOff(run: () => void) {
	handingOff = true
	requestAnimationFrame(() => {
		handingOff = false
	})
	run()
}

/** How something opening or closing now should move; `keyboard` is the motion when the keyboard did it. */
export const motionNow = (keyboard: DialogMotion): DialogMotion =>
	handingOff || (keyboard === 'instant' && lastInput === 'keyboard') ? 'instant' : 'animated'

/**
 * A dialog's motion, decided when it opens or closes and held until the next change. Read live, a
 * mouse press inside a keyboard-opened dialog would switch its entry animation on and replay it.
 * `keyboard` is the motion when the keyboard opens or closes it.
 */
export function useDialogMotion({
	open,
	keyboard,
}: {
	open: boolean
	keyboard: DialogMotion
}): DialogMotion {
	const [latched, setLatched] = useState(() => ({ open, motion: motionNow(keyboard) }))
	if (latched.open === open) return latched.motion
	const next = { open, motion: motionNow(keyboard) }
	setLatched(next)
	return next.motion
}
