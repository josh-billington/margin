import { useState } from 'react'
import type { DictionaryBodyProps } from './dictionaries'
import { tidy, withReferences } from './references'

/** Renderings longer than this collapse to two lines with a "Show all" toggle. */
const RENDERINGS_FIT = 90

/** Strong's renderings end with "Compare H3050 (…), H3069 (…)." — pull that into its own row. */
function splitRenderings(renderings: string) {
	const match = /^(.*?)[.;,]?\s*Compare\s+((?:[HG]\d|names\b).*)$/s.exec(renderings)
	return match
		? { renderings: tidy(match[1] ?? ''), related: tidy(match[2] ?? '') }
		: { renderings: tidy(renderings), related: '' }
}

export function StrongsEntry({ entry, follow }: DictionaryBodyProps) {
	const [expanded, setExpanded] = useState(false)
	const parts = entry.renderings ? splitRenderings(entry.renderings) : null
	const long = !!parts && parts.renderings.length > RENDERINGS_FIT
	return (
		<>
			<p className="lookup-definition">
				{entry.definition
					? withReferences(tidy(entry.definition), follow)
					: 'No definition recorded in this dictionary.'}
			</p>
			{(parts?.renderings || entry.derivation || parts?.related) && (
				<dl className="lookup-facts">
					{parts?.renderings && (
						<>
							<dt>KJV</dt>
							<dd>
								<span className={long && !expanded ? 'lookup-collapsed' : undefined}>
									{parts.renderings}
								</span>
								{long && (
									<button
										className="text-button"
										aria-expanded={expanded}
										onClick={() => setExpanded(!expanded)}
									>
										{expanded ? 'Show less' : 'Show all'}
									</button>
								)}
							</dd>
						</>
					)}
					{entry.derivation && (
						<>
							<dt>Origin</dt>
							<dd>{withReferences(tidy(entry.derivation), follow)}</dd>
						</>
					)}
					{parts?.related && (
						<>
							<dt>Compare</dt>
							<dd>{withReferences(parts.related, follow)}</dd>
						</>
					)}
				</dl>
			)}
		</>
	)
}
