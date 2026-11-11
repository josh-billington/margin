import { useEffect, useState } from 'react'
import type { InsertionPreview } from '@shared/bible/reference'
import type { MappedPassage } from '@shared/ipc/contract'
import type { TranslationId } from '@shared/bible/types'

export type ResolvedPreview = Extract<InsertionPreview, { kind: 'resolved' }>
export type PreviewState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'failed'; message: string }
	| { status: 'error'; error: Extract<InsertionPreview, { kind: 'error' }> }
	| {
			status: 'resolved'
			preview: ResolvedPreview
			equivalent: MappedPassage | null
			/** Inputs changed since this resolved; it must not be submitted until the refresh lands. */
			stale?: boolean
	  }

/** Resolves as the reader types. Stale responses are dropped; nothing is ever guessed. */
export function usePreview(
	query: string,
	translationId: TranslationId,
	oldTestamentTranslationId?: TranslationId,
	delay = 200,
): PreviewState {
	const [state, setState] = useState<PreviewState>({ status: 'idle' })
	useEffect(() => {
		const reference = query.trim()
		if (!reference) {
			setState({ status: 'idle' })
			return
		}
		let current = true
		setState((previous) =>
			previous.status === 'resolved' ? { ...previous, stale: true } : { status: 'loading' },
		)
		const timer = setTimeout(() => {
			void (async () => {
				const result = await window.margin.bible.resolveReference({
					reference,
					translationId,
					oldTestamentTranslationId,
				})
				if (!current) return
				if (!result.ok) return setState({ status: 'failed', message: result.error.message })
				if (result.data.kind === 'error') return setState({ status: 'error', error: result.data })
				const preview = result.data
				const mapped = await window.margin.bible.mapPassage({
					from: preview.translation,
					to: preview.translation === 'jps1917' ? 'kjv' : 'jps1917',
					ranges: preview.ranges,
				})
				if (current)
					setState({ status: 'resolved', preview, equivalent: mapped.ok ? mapped.data : null })
			})().catch(() => {
				if (current) setState({ status: 'failed', message: 'Scripture could not be read.' })
			})
		}, delay)
		return () => {
			current = false
			clearTimeout(timer)
		}
	}, [query, translationId, oldTestamentTranslationId, delay])
	return state
}
