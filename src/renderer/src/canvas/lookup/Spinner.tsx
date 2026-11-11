import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { iconMd } from '../../lib/icons'

/**
 * An indeterminate spinner that only appears once work has taken longer than `delay`, so fast
 * local reads never flash it. Announces `label` to assistive tech either way.
 */
export function Spinner({ label = 'Loading', delay = 200 }: { label?: string; delay?: number }) {
	const [shown, setShown] = useState(delay <= 0)
	useEffect(() => {
		if (delay <= 0) return
		const timer = setTimeout(() => setShown(true), delay)
		return () => clearTimeout(timer)
	}, [delay])
	return (
		<span className="spinner" role="status" aria-label={label}>
			{shown && <LoaderCircle {...iconMd} aria-hidden />}
		</span>
	)
}
