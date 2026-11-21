import { useEffect, useState } from 'react'
import type { BdbEntry } from '@shared/lexicon/bdb'

type BdbResult = { kind: 'loaded'; id: string; entries: BdbEntry[] } | { kind: 'error'; id: string }

export function useBdb(id: string | undefined) {
	const [result, setResult] = useState<BdbResult>()
	const current = result?.id === id ? result : undefined
	useEffect(() => {
		if (!id || current) return
		let active = true
		void window.margin.lexicon
			.getBdbEntries({ id })
			.then((response) => {
				if (!active) return
				setResult(
					response.ok ? { kind: 'loaded', id, entries: response.data } : { kind: 'error', id },
				)
			})
			.catch(() => {
				if (active) setResult({ kind: 'error', id })
			})
		return () => {
			active = false
		}
	}, [id, current])
	return { result: current, retry: () => setResult(undefined) }
}
