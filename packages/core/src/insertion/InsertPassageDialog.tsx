import './insert.css'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import { books, normalizeBookAlias } from '@shared/bible/books'
import { looksLikeReference } from '@shared/bible/reference'
import { BIBLE_SEARCH_QUERY_LENGTH } from '@shared/bible/search'
import type { BibleSearchHit } from '@shared/bible/search'
import type { PassageRange, TranslationId } from '@shared/bible/types'
import { insertPassage } from '../canvas/tools/commands'
import { Spinner } from '../canvas/lookup/Spinner'
import { iconSm } from '../lib/icons'
import { BibleSearchResults } from './BibleSearchResults'
import type { SearchPick } from './BibleSearchResults'
import { blockNoun, formatRanges, translationNames, translationOrder } from './labels'
import { usePreview } from './usePreview'
import type { PreviewState } from './usePreview'
import { useDialogMotion } from '../app/dialogMotion'
import { useLingering } from '../lib/useLingering'
import { useBibleSearch } from './useBibleSearch'
import type { SearchList, SearchState } from './useBibleSearch'

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
	initialQuery: string
	editor: Editor | null
	translation: TranslationId
	oldTestamentTranslation?: TranslationId
	onTranslationChange: (translation: TranslationId) => void
}

/** Shown while the reference is still being typed; the parser's own message waits for Enter. */
const TYPING_HINT = 'Enter a book and chapter.'

function PreviewBody({
	state,
	onPick,
	insist,
}: {
	state: PreviewState
	onPick: (value: string) => void
	/** The reader pressed Enter on an unresolved reference: show the error as an error. */
	insist: boolean
}) {
	switch (state.status) {
		case 'idle':
			return null
		case 'loading':
			return (
				<div className="insert-loading" aria-busy="true">
					<Spinner label="Looking up verses" />
				</div>
			)
		case 'failed':
			return (
				<p className="insert-error" role="alert">
					{state.message}
				</p>
			)
		case 'error':
			// Half-typed references are normal: a quiet hint until the reader commits with Enter.
			if (!insist && state.error.code === 'INVALID_SYNTAX')
				return <p className="insert-hint">{TYPING_HINT}</p>
			return (
				<div role={insist ? 'alert' : undefined} aria-live={insist ? undefined : 'polite'}>
					<p className={insist ? 'insert-error' : 'insert-hint'}>{state.error.message}</p>
					{state.error.candidates.length > 0 && (
						<ul className="insert-candidates" aria-label="Suggested books">
							{state.error.candidates.map((candidate) => (
								<li key={candidate}>
									<button type="button" onClick={() => onPick(candidate)}>
										{candidate}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)
		case 'resolved': {
			const { preview, equivalent } = state
			// Only mention the other translation when its numbering actually differs.
			const other =
				equivalent && equivalent.kind !== 'incomplete' && equivalent.ranges.length > 0
					? formatRanges(equivalent.ranges)
					: null
			const showOther = other !== null && other !== formatRanges(preview.ranges)
			return (
				<div className="insert-preview" aria-live="polite">
					<strong>{preview.label}</strong>
					<span>{translationNames[preview.translation].long}</span>
					{preview.notice && <p className="insert-notice">{preview.notice}</p>}
					{showOther && equivalent && (
						<span className="insert-equivalent">
							{other} in {translationNames[equivalent.translation].short}
							{equivalent.kind === 'confirmation-required' && ' (partial verses)'}
						</span>
					)}
				</div>
			)
		}
	}
}

/** "Joh" finds no verses, but it may be the start of a reference: say how to finish one. */
const startsBookName = (query: string) => {
	const typed = normalizeBookAlias(query)
	return (
		/\p{L}/u.test(typed) && books.some(({ name }) => normalizeBookAlias(name).startsWith(typed))
	)
}

function describeSearch({
	state,
	shown,
	query,
	slow,
}: {
	state: SearchState
	shown: number
	query: string
	/** The first results have taken long enough to say so; a fast search never flashes it. */
	slow: boolean
}) {
	switch (state.kind) {
		case 'idle':
			return ''
		case 'loading':
			return state.previous
				? describeTotal({ total: state.previous.counts.total, shown, query })
				: slow
					? 'Searching…'
					: ''
		case 'error':
			return state.message
		case 'ready':
			return describeTotal({ total: state.list.counts.total, shown, query })
	}
}

function describeTotal({ total, shown, query }: { total: number; shown: number; query: string }) {
	if (!total && startsBookName(query)) return TYPING_HINT
	if (!total) return 'No verses found. Try other words or another translation.'
	if (total === 1) return '1 verse found'
	const count = total.toLocaleString()
	return shown < total ? `Showing ${shown} of ${count} verses` : `${count} verses found`
}

/**
 * One block per run of consecutive verses (hits arrive in canonical order), so Psalm 25:6 and
 * Psalm 51:1 land as two blocks rather than reading as one passage.
 */
function passageRequests(hits: readonly BibleSearchHit[]) {
	const requests: { translationId: TranslationId; ranges: [PassageRange] }[] = []
	for (const { translationId, ref } of hits) {
		const last = requests.at(-1)
		const end = last?.ranges[0].end
		if (
			last?.translationId === translationId &&
			end?.book === ref.book &&
			end.chapter === ref.chapter &&
			end.verse + 1 === ref.verse
		)
			last.ranges[0].end = ref
		else requests.push({ translationId, ranges: [{ start: ref, end: ref }] })
	}
	return requests
}

export function InsertPassageDialog({
	open,
	onOpenChange,
	initialQuery,
	editor,
	translation,
	oldTestamentTranslation,
	onTranslationChange,
}: Props) {
	const [query, setQuery] = useState(initialQuery)
	const [busy, setBusy] = useState(false)
	const motion = useDialogMotion({ open, keyboard: 'instant' })
	const generation = useRef(0)
	const inFlight = useRef(false)
	useEffect(() => {
		inFlight.current = false
		setBusy(false)
		return () => {
			generation.current++
			inFlight.current = false
		}
	}, [open, editor])
	function changeOpen(next: boolean) {
		if (!next) {
			generation.current++
			inFlight.current = false
			setBusy(false)
		}
		onOpenChange(next)
	}
	const [insist, setInsist] = useState(false)
	useEffect(() => setInsist(false), [query, open])
	// The dialog widens the first time results show and stays wide until it closes, so editing
	// the query never flips its width back and forth.
	const [wide, setWide] = useState(false)
	// A translation picked from the pop-up outranks the Old Testament default (a qualifier still
	// outranks both).
	const [chosen, setChosen] = useState<TranslationId | null>(null)
	// Scope narrows a search; it starts at the whole Bible each time the dialog opens.
	const [scope, setScope] = useState('all')
	// Each opening starts fresh, reset while rendering so its first frame never shows the last
	// session's query, results or width. Closing changes nothing: the dialog leaves as it was.
	const [session, setSession] = useState({ open, initialQuery })
	if (session.open !== open || (open && session.initialQuery !== initialQuery)) {
		setSession({ open, initialQuery })
		if (open) setQuery(initialQuery)
		if (open && !session.open) {
			setWide(false)
			setChosen(null)
			setScope('all')
		}
	}
	// A reference ("John 3", "Amos 1:3–5") previews as before; anything else searches.
	const mode = !query.trim() ? 'empty' : looksLikeReference(query) ? 'reference' : 'search'
	const state = usePreview(
		mode === 'reference' ? query : '',
		chosen ?? translation,
		chosen ? undefined : oldTestamentTranslation,
	)
	const resolved = state.status === 'resolved' ? state.preview : null
	// A fallback notice (JPS + NT) asks the reader to confirm the actual translation.
	const switched = !!resolved?.notice && resolved.translation !== (chosen ?? translation)

	const search = useBibleSearch({
		query: mode === 'search' ? query : '',
		edition: chosen,
		translation,
		oldTestamentTranslation,
		scope,
	})
	const list: SearchList | undefined =
		search.state.kind === 'ready'
			? search.state.list
			: search.state.kind === 'loading'
				? search.state.previous
				: undefined
	const hits = list?.hits ?? []
	// More pages remain for the query on screen (not one still being typed).
	const more = search.state.kind === 'ready' && search.state.list.next !== null
	// The selection follows the active row (click, arrows) until ⌘-click, ⇧ or Space starts marking
	// rows; from then on the arrows only move the active row. Return adds whatever is selected.
	const [active, setActive] = useState(0)
	const [selected, setSelected] = useState<ReadonlySet<number>>(new Set([0]))
	const [marking, setMarking] = useState(false)
	const anchor = useRef(0)
	const listbox = useRef<HTMLDivElement>(null)
	const input = useRef<HTMLInputElement>(null)
	// End, or ArrowDown on the last loaded row, waits for the next page and then carries on: to
	// the new last row (End keeps loading until the end), or one row on.
	const follow = useRef<{ to: 'end' | 'next'; from: number; kind: 'select' | 'range' | 'move' }>(
		null,
	)
	useEffect(() => {
		setActive(0)
		setSelected(new Set([0]))
		setMarking(false)
		anchor.current = 0
		follow.current = null
	}, [search.key])
	// Hits only ever append, so selected indices stay valid while pages load; they're added in
	// canonical order even when their rows are scrolled out of the rendered range.
	const chosenHits = [...selected]
		.sort((left, right) => left - right)
		.flatMap((index) => hits[index] ?? [])
	const searchReady = search.state.kind === 'ready'
	const searchSlow = useLingering(search.state.kind === 'loading' && !list, 300)

	// The list scrolls to the active row itself, since the row may not be rendered yet.
	const [reveal, setReveal] = useState(0)
	function moveTo(index: number) {
		setActive(index)
		setReveal((count) => count + 1)
	}

	function step(index: number, kind: 'select' | 'range' | 'move') {
		if (kind === 'move') moveTo(index)
		else pick({ index, kind })
	}
	useEffect(() => {
		const pending = follow.current
		if (!pending || busy) return
		const last = hits.length - 1
		if (pending.to === 'next') {
			if (last <= pending.from) return
			follow.current = null
			return step(pending.from + 1, pending.kind)
		}
		if (last > pending.from) step(last, pending.kind)
		pending.from = last
		if (more) search.loadMore()
		else follow.current = null
	}, [hits.length])

	function pick({ index, kind }: SearchPick) {
		if (busy || !hits[index]) return
		moveTo(index)
		if (kind === 'add') return void confirm([index])
		if (kind === 'range') {
			const [first, last] = [Math.min(anchor.current, index), Math.max(anchor.current, index)]
			setMarking(true)
			return setSelected(new Set(Array.from({ length: last - first + 1 }, (_, i) => first + i)))
		}
		anchor.current = index
		if (kind === 'select') {
			setMarking(false)
			return setSelected(new Set([index]))
		}
		// The first mark keeps what is already selected, so it never drops the row it started from.
		const next = new Set(selected)
		if (!marking) next.add(index)
		else if (!next.delete(index)) next.add(index)
		setMarking(true)
		setSelected(next)
	}

	function onResultsKey(event: KeyboardEvent<HTMLDivElement>) {
		if (busy || !hits.length) return
		const last = hits.length - 1
		const move: Record<string, number> = {
			ArrowDown: Math.min(last, active + 1),
			ArrowUp: active - 1,
			Home: 0,
			End: last,
		}
		const to = move[event.key]
		follow.current = null
		if (to !== undefined) {
			event.preventDefault()
			if (to < 0) return input.current?.focus()
			const kind = marking && !event.shiftKey ? 'move' : event.shiftKey ? 'range' : 'select'
			const ahead =
				event.key === 'End' ? 'end' : event.key === 'ArrowDown' && active === last ? 'next' : null
			if (ahead && more) {
				follow.current = { to: ahead, from: last, kind }
				search.loadMore()
			}
			step(to, kind)
		} else if (event.key === ' ') {
			event.preventDefault()
			pick({ index: active, kind: 'toggle' })
		} else if (event.key === 'Enter') {
			event.preventDefault()
			void confirm()
		} else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
			// Typing goes back to the field, which receives the key.
			input.current?.focus()
		}
	}

	async function confirm(only?: number[]) {
		const searchHits = only ? only.flatMap((index) => hits[index] ?? []) : chosenHits
		const requests =
			mode === 'search'
				? searchReady || only
					? passageRequests(searchHits)
					: []
				: resolved && !(state.status === 'resolved' && state.stale)
					? [{ translationId: resolved.translation, ranges: resolved.ranges }]
					: []
		if (!requests.length || !editor || busy || inFlight.current) return
		setBusy(true)
		inFlight.current = true
		const request = ++generation.current
		try {
			const passages = await Promise.all(requests.map((r) => window.margin.bible.getPassage(r)))
			if (request !== generation.current) return
			for (const result of passages) if (!result.ok) return void toast.error(result.error.message)
			for (const result of passages) if (result.ok) insertPassage(editor, result.data)
			changeOpen(false)
		} catch {
			if (request === generation.current) toast.error('Margin couldn’t load the verses. Try again.')
		} finally {
			if (request === generation.current) {
				inFlight.current = false
				setBusy(false)
			}
		}
	}

	// Adding is usually quicker than a frame or two: the button only says so when it isn't, so it
	// never flickers on the way out.
	const adding = useLingering(busy)
	const addLabel = adding
		? 'Adding…'
		: mode === 'search'
			? chosenHits.length > 1
				? `Add ${chosenHits.length} verses`
				: 'Add verse'
			: switched && resolved
				? `Add verses in ${translationNames[resolved.translation].short}`
				: `Add ${resolved ? blockNoun(resolved.ranges, resolved.translation) : 'verses'}`
	const canAdd =
		!!editor &&
		!adding &&
		(mode === 'search'
			? searchReady && chosenHits.length > 0
			: !!resolved && !(state.status === 'resolved' && state.stale))
	const showResults = mode === 'search' && hits.length > 0
	// Set while rendering, so the dialog starts widening in the frame the results first show.
	if (open && showResults && !wide) setWide(true)

	return (
		<Dialog.Root open={open} onOpenChange={changeOpen}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay" data-motion={motion} />
				<Dialog.Content
					className="command-dialog insert-dialog"
					data-motion={motion}
					data-wide={wide}
					aria-describedby="insert-description"
				>
					<Dialog.Title className="insert-title">Add verses</Dialog.Title>
					<Dialog.Description id="insert-description" className="sr-only">
						Enter a Bible reference, or words to search for. Check the verses before adding them.
					</Dialog.Description>
					<form
						onSubmit={(event) => {
							event.preventDefault()
							void confirm()
						}}
					>
						<div className="insert-row">
							<input
								ref={input}
								autoFocus
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								onKeyDown={(event) => {
									if (event.nativeEvent.isComposing) return
									if (mode === 'search' && event.key === 'ArrowDown' && hits.length) {
										event.preventDefault()
										listbox.current?.focus()
									}
									// A disabled submit button blocks implicit submission, so Enter is caught here.
									if (event.key === 'Enter' && mode !== 'search' && !resolved) setInsist(true)
								}}
								placeholder="Amos 1:3–5 or words to find"
								aria-label="Reference or words to search"
								role="combobox"
								aria-autocomplete="list"
								aria-expanded={showResults}
								aria-controls="search-results"
								maxLength={BIBLE_SEARCH_QUERY_LENGTH}
								autoComplete="off"
								spellCheck={false}
							/>
							<label className="plain-popup insert-translation">
								<span className="sr-only">Translation</span>
								<select
									value={chosen ?? resolved?.translation ?? translation}
									onChange={(event) => {
										const id = event.target.value as TranslationId
										setChosen(id)
										onTranslationChange(id)
									}}
								>
									{translationOrder.map((id) => (
										<option value={id} key={id}>
											{translationNames[id].short}
										</option>
									))}
								</select>
								<ChevronDown {...iconSm} aria-hidden="true" />
							</label>
						</div>
						<div className="insert-feedback">
							{mode === 'search' ? (
								<div className="search-status">
									<p role="status">
										{describeSearch({
											state: search.state,
											shown: hits.length,
											query,
											slow: searchSlow,
										})}
									</p>
									<label className="plain-popup">
										<span className="sr-only">Search in</span>
										<select value={scope} onChange={(event) => setScope(event.target.value)}>
											<option value="all">Whole Bible</option>
											<option value="old">Old Testament</option>
											<option value="new">New Testament</option>
											{(['old', 'new'] satisfies ('old' | 'new')[]).map((testament) => (
												<optgroup
													key={testament}
													label={
														testament === 'old' ? 'Old Testament books' : 'New Testament books'
													}
												>
													{books
														.filter((book) => book.testament === testament)
														.map(({ id, name }) => (
															<option value={id} key={id}>
																{name}
															</option>
														))}
												</optgroup>
											))}
										</select>
										<ChevronDown {...iconSm} aria-hidden="true" />
									</label>
								</div>
							) : (
								<PreviewBody state={state} onPick={setQuery} insist={insist} />
							)}
						</div>
						<BibleSearchResults
							listRef={listbox}
							list={list}
							open={showResults}
							busy={search.state.kind === 'loading' || list?.more === 'loading'}
							active={active}
							reveal={reveal}
							selected={selected}
							translation={chosen ?? translation}
							onPick={(value) => {
								follow.current = null
								pick(value)
							}}
							onLoadMore={search.loadMore}
							onKeyDown={onResultsKey}
						/>
						<div className="insert-actions">
							<button type="button" className="button" onClick={() => changeOpen(false)}>
								Cancel
							</button>
							<button type="submit" className="button button-primary" disabled={!canAdd}>
								{addLabel}
							</button>
						</div>
					</form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
