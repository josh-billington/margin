import type { ReactNode } from 'react'

/** A Strong's reference in dictionary text, with its optional lemma: "H3050 (יָהּ)". */
const REFERENCE = /\b([HG])0*([1-9]\d*)(?:\s*\(([^)]+)\))?/g

/** Dictionary text often ends mid-list ("a primitive root;"); drop the dangling punctuation. */
export const tidy = (text: string) => text.trim().replace(/[;,:.]+$/, '')

/** Dictionary text with each Strong's reference as a link that opens that entry in place. */
export function withReferences(text: string, open: (id: string) => void): ReactNode[] {
	const parts: ReactNode[] = []
	let last = 0
	for (const match of text.matchAll(REFERENCE)) {
		const [whole, letter = '', digits = '', lemma] = match
		const id = letter + digits
		if (match.index > last) parts.push(text.slice(last, match.index))
		parts.push(
			<button key={match.index} className="lookup-ref" onClick={() => open(id)}>
				{id}
				{lemma && (
					<span lang={letter === 'H' ? 'he' : 'grc'} dir="auto">
						{lemma}
					</span>
				)}
			</button>,
		)
		last = match.index + whole.length
	}
	if (last < text.length) parts.push(text.slice(last))
	return parts
}
