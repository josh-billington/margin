import { books } from '@shared/bible/books'
import type { BibleSearchHit, BibleSearchResults as Results } from '@shared/bible/search'
import type { TranslationId } from '@shared/bible/types'
import { formatRange, translationNames } from './labels'

function VerseSnippet({ text, matches }: BibleSearchHit) {
	let offset = 0
	return (
		<>
			{matches.map(([start, end]) => {
				const before = text.slice(offset, start)
				offset = end
				return (
					<span key={start}>
						{before}
						<mark>{text.slice(start, end)}</mark>
					</span>
				)
			})}
			{text.slice(offset)}
		</>
	)
}

export const searchOptionId = (index: number) => `search-hit-${index}`

export type SearchPick = { index: number; kind: 'select' | 'toggle' | 'range' | 'add' }

/** Results grouped by book. Rows are options of the listbox that wraps this list. */
export function BibleSearchResults({
	groups,
	active,
	selected,
	translation,
	onPick,
}: {
	groups: Results['groups']
	active: number
	selected: ReadonlySet<number>
	/** The translation the picker shows; rows name theirs only when it differs. */
	translation: TranslationId
	onPick: (pick: SearchPick) => void
}) {
	let offset = 0
	return groups.map((group) => {
		const start = offset
		offset += group.hits.length
		const heading = `search-group-${group.book}`
		return (
			<div role="group" aria-labelledby={heading} key={group.book}>
				<div id={heading} className="search-group-heading">
					{books.find(({ id }) => id === group.book)?.name}
					<span>{group.total.toLocaleString()}</span>
				</div>
				{group.hits.map((hit, position) => {
					const index = start + position
					return (
						<div
							id={searchOptionId(index)}
							role="option"
							aria-selected={selected.has(index)}
							data-active={index === active}
							className="search-hit"
							key={`${hit.translationId}:${hit.ref.chapter}:${hit.ref.verse}`}
							onMouseDown={(event) => event.preventDefault()}
							onClick={(event) =>
								onPick({
									index,
									kind: event.shiftKey
										? 'range'
										: event.metaKey || event.ctrlKey
											? 'toggle'
											: 'select',
								})
							}
							onDoubleClick={() => onPick({ index, kind: 'add' })}
						>
							<span className="search-hit-ref">
								{formatRange({ start: hit.ref, end: hit.ref })}
								{hit.translationId !== translation && (
									<span> · {translationNames[hit.translationId].short}</span>
								)}
							</span>{' '}
							<span className="search-hit-text">
								<VerseSnippet {...hit} />
							</span>
						</div>
					)
				})}
			</div>
		)
	})
}
