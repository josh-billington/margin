export interface NoteSegment {
	text: string
	emphasis: boolean
}

/** Splits `*emphasis*` runs; unmatched or empty asterisks stay literal. */
export function parseEmphasis(text: string): NoteSegment[] {
	const segments: NoteSegment[] = []
	const pattern = /\*(?!\s)([^*\n]*[^*\s])\*/g
	let last = 0
	for (const match of text.matchAll(pattern)) {
		if (match.index > last) segments.push({ text: text.slice(last, match.index), emphasis: false })
		segments.push({ text: match[1] ?? '', emphasis: true })
		last = match.index + match[0].length
	}
	if (last < text.length) segments.push({ text: text.slice(last), emphasis: false })
	return segments
}

export const stripEmphasis = (text: string) =>
	parseEmphasis(text)
		.map((s) => s.text)
		.join('')
