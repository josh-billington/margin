import type { Editor } from 'tldraw'
import type { WordTarget } from '@shared/study/types'
import type { PassageShape } from '../shapes/types'
import { getHighlightColor } from './highlightColor'
import { replaceRange } from './ranges'
import type { Paint } from './ranges'

/** Paints (or, with null, clears) a word range as one undo step. */
export function paintRange(
	editor: Editor,
	shape: PassageShape,
	start: WordTarget,
	end: WordTarget,
	paint: Paint | null,
	label = 'highlight',
) {
	const current = editor.getShape(shape.id)
	if (current?.type !== 'passage') return
	editor.markHistoryStoppingPoint(label)
	editor.updateShape({
		id: shape.id,
		type: 'passage',
		props: {
			highlights: replaceRange(current.props.text, current.props.highlights, start, end, paint),
		},
	})
}

/** Highlight mode: apply a plain highlight in the current colour right away. */
export const applyPlainHighlight = (
	editor: Editor,
	shape: PassageShape,
	start: WordTarget,
	end: WordTarget,
) => paintRange(editor, shape, start, end, { color: getHighlightColor() })
