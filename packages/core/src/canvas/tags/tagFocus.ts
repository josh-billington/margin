import { create } from 'zustand'
import type { Highlight } from '@shared/study/types'
import type { Editor, TLShapeId } from 'tldraw'
import { orderTagMatches, verseKey } from '../highlights/ranges'
import { pagePassages } from './tagOps'

interface TagFocus {
	tagId: string | null
	/** Index of the current match; -1 before any navigation. */
	index: number
	/** Bumped on each selection so the brief emphasis replays. */
	pulse: number
	/** The current match, for stronger emphasis. */
	currentHighlightId: string | null
}
export const useTagFocus = create<TagFocus>(() => ({
	tagId: null,
	index: -1,
	pulse: 0,
	currentHighlightId: null,
}))

export const tagMatches = (editor: Editor, tagId: string) =>
	orderTagMatches(
		pagePassages(editor).map((p) => ({
			id: p.id,
			x: p.x,
			y: p.y,
			text: p.props.text,
			highlights: p.props.highlights,
		})),
		tagId,
	)

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function panTo(editor: Editor, match: { passageId: string; highlight: Highlight }) {
	const { verse, token } = match.highlight.start
	const word = editor
		.getContainer()
		.querySelector(
			`[data-passage-id="${match.passageId}"][data-verse-ref="${verseKey(verse)}"][data-token-index="${token}"]`,
		)
	const rect = word?.getBoundingClientRect()
	const point = rect
		? editor.screenToPage({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
		: editor.getShapePageBounds(match.passageId as TLShapeId)?.center
	if (point)
		editor.centerOnPoint(point, reducedMotion() ? undefined : { animation: { duration: 280 } })
}

export function selectTag(tagId: string | null) {
	if (tagId === useTagFocus.getState().tagId) tagId = null
	useTagFocus.setState((s) => ({ tagId, index: -1, pulse: s.pulse + 1, currentHighlightId: null }))
}
export function stepTagMatch(editor: Editor, delta: 1 | -1) {
	const { tagId, index } = useTagFocus.getState()
	if (!tagId) return
	const matches = tagMatches(editor, tagId)
	if (!matches.length) return
	const next =
		((((index < 0 ? (delta > 0 ? -1 : 0) : index) + delta) % matches.length) + matches.length) %
		matches.length
	const match = matches[next]
	if (!match) return
	useTagFocus.setState((s) => ({
		index: next,
		pulse: s.pulse + 1,
		currentHighlightId: match.highlight.id,
	}))
	panTo(editor, match)
}
export const clearTagFocus = () =>
	useTagFocus.setState({ tagId: null, index: -1, currentHighlightId: null })
