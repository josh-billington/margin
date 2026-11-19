export interface AnnotationCounts {
	highlights: number
	wordArrows: number
}

/** The translation and range lock (SPEC §4.1): null when the block is unannotated. */
export function translationLockReason({ highlights, wordArrows }: AnnotationCounts): string | null {
	const parts = [
		highlights && `${highlights} highlight${highlights === 1 ? '' : 's'}`,
		wordArrows &&
			`${wordArrows} ${wordArrows === 1 ? 'arrow attached to a word' : 'arrows attached to words'}`,
	].filter(Boolean)
	return parts.length
		? `This block has ${parts.join(' and ')}. Remove ${highlights + wordArrows === 1 ? 'it' : 'them'} to change the translation.`
		: null
}
