export interface AnnotationCounts {
	highlights: number
	wordArrows: number
}

/** The translation and range lock (SPEC §4.1): null when the block is unannotated. */
export function translationLockReason({ highlights, wordArrows }: AnnotationCounts): string | null {
	const parts = [
		highlights && `${highlights} highlight${highlights === 1 ? '' : 's'}`,
		wordArrows && `${wordArrows} word-bound arrow${wordArrows === 1 ? '' : 's'}`,
	].filter(Boolean)
	return parts.length
		? `Locked by ${parts.join(' and ')}. Remove them to change the translation.`
		: null
}
