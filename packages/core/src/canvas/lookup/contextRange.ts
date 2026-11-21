import type { PassageText } from '@shared/bible/types'
import type { WordTarget } from '@shared/study/types'
import { wordIndex } from '../highlights/ranges'
import type { TagRequest } from '../highlights/tagging'

/**
 * What a right-click Look Up acts on, as on macOS: the live text selection when it contains the
 * clicked word, otherwise just the clicked word. A tag around the word is not a selection.
 */
export function contextLookupRequest(
	text: PassageText,
	passageId: string,
	selection: TagRequest | null,
	clicked: WordTarget,
	point: { x: number; y: number },
): TagRequest {
	if (selection?.passageId === passageId) {
		const at = wordIndex(text, clicked),
			start = wordIndex(text, selection.start),
			end = wordIndex(text, selection.end)
		if (at >= Math.min(start, end) && at <= Math.max(start, end)) return selection
	}
	return { passageId, start: clicked, end: clicked, ...point }
}
