import { useEffect, useState } from 'react'

/**
 * True once `active` has stayed true for `delay` ms, so fast work never flashes a busy state (the
 * same rule as the delayed spinners). Falls back to false as soon as `active` does.
 */
export function useLingering(active: boolean, delay = 200): boolean {
	const [lingering, setLingering] = useState(false)
	useEffect(() => {
		if (!active) return setLingering(false)
		const timer = setTimeout(() => setLingering(true), delay)
		return () => clearTimeout(timer)
	}, [active, delay])
	return active && lingering
}
