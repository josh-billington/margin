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
import { BibleSearchResults, searchOptionId } from './BibleSearchResults'
import type { SearchPick } from './BibleSearchResults'
import { blockNoun, formatRanges, translationNames, translationOrder } from './labels'
import { usePreview } from './usePreview'
import type { PreviewState } from './usePreview'
import { useDialogMotion } from '../app/dialogMotion'
import { useBibleSearch } from './useBibleSearch'
import type { SearchState } from './useBibleSearch'

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
}: {
	state: SearchState
	shown: number
	query: string
}) {
	switch (state.kind) {
		case 'idle':
			return ''
		case 'loading':
			return state.previous
				? describeTotal({ total: state.previous.total, shown, query })
				: 'Searching…'
		case 'error':
			return state.message
		case 'ready':
			return describeTotal({ total: state.results.total, shown, query })
	}
}

function describeTotal({ total, shown, query }: { total: number; shown: number; query: string }) {
	if (!total && startsBookName(query)) return TYPING_HINT
	if (!total) return 'No verses found. Try other words or another translation.'
	if (total === 1) return '1 verse found'
	const count = total.toLocaleString()
	return shown < total ? `Showing ${shown} of ${count} verses` : `${count} verses found`
}

/** One passage request per translation, so several verses from one search land as one block. */
function passageRequests(hits: readonly BibleSearchHit[]) {
	const byTranslation = new Map<TranslationId, PassageRange[]>()
	for (const { translationId, ref } of hits)
		byTranslation.set(translationId, [
			...(byTranslation.get(translationId) ?? []),
			{ start: ref, end: ref },
		])
	return Array.from(byTranslation, ([translationId, ranges]) => ({ translationId, ranges }))
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
	useEffect(() => {
		if (open) setQuery(initialQuery)
	}, [open, initialQuery])
	useEffect(() => setInsist(false), [query, open])
	// An explicit toggle click outranks the Old Testament default (a qualifier still outranks both).
	const [chosen, setChosen] = useState<TranslationId | null>(null)
	// Scope narrows a search; it starts at the whole Bible each time the dialog opens.
	const [scope, setScope] = useState('all')
	useEffect(() => {
		if (open) {
			setChosen(null)
			setScope('all')
		}
	}, [open])
	// A reference ("John 3", "Amos 1:3–5") previews as before; anything else searches.
	const mode = !query.trim() ? 'empty' : looksLikeReference(query) ? 'reference' : 'search'
	const state = usePreview(
		open && mode === 'reference' ? query : '',
		chosen ?? translation,
		chosen ? undefined : oldTestamentTranslation,
	)
	const resolved = state.status === 'resolved' ? state.preview : null
	// A fallback notice (JPS + NT) asks the reader to confirm the actual translation.
	const switched = !!resolved?.notice && resolved.translation !== (chosen ?? translation)

	const search = useBibleSearch({
		query: open && mode === 'search' ? query : '',
		edition: chosen,
		translation,
		oldTestamentTranslation,
		scope,
	})
	const results =
		search.state.kind === 'ready'
			? search.state.results
			: search.state.kind === 'loading'
				? search.state.previous
				: undefined
	const groups = results?.groups ?? []
	const hits = groups.flatMap((group) => group.hits)
	// The selection follows the active row (click, arrows) until ⌘-click, ⇧ or Space starts marking
	// rows; from then on the arrows only move the active row. Return adds whatever is selected.
	const [active, setActive] = useState(0)
	const [selected, setSelected] = useState<ReadonlySet<number>>(new Set([0]))
	const [marking, setMarking] = useState(false)
	const anchor = useRef(0)
	const listbox = useRef<HTMLDivElement>(null)
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		setActive(0)
		setSelected(new Set([0]))
		setMarking(false)
		anchor.current = 0
	}, [search.key])
	const chosenHits = hits.filter((_, index) => selected.has(index))
	const searchReady = search.state.kind === 'ready'

	function moveTo(index: number) {
		setActive(index)
		document.getElementById(searchOptionId(index))?.scrollIntoView({ block: 'nearest' })
	}

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
		if (to !== undefined) {
			event.preventDefault()
			if (to < 0) return input.current?.focus()
			if (marking && !event.shiftKey) return moveTo(to)
			pick({ index: to, kind: event.shiftKey ? 'range' : 'select' })
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

	const addLabel = busy
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
		!busy &&
		(mode === 'search'
			? searchReady && chosenHits.length > 0
			: !!resolved && !(state.status === 'resolved' && state.stale))
	const showResults = mode === 'search' && hits.length > 0

	return (
		<Dialog.Root open={open} onOpenChange={changeOpen}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay" data-motion={motion} />
				<Dialog.Content
					className="command-dialog insert-dialog"
					data-motion={motion}
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
							<div
								role="radiogroup"
								aria-label="Translation"
								className="segmented insert-translations"
							>
								{translationOrder.map((id) => (
									<button
										key={id}
										type="button"
										role="radio"
										aria-checked={(chosen ?? resolved?.translation ?? translation) === id}
										onClick={() => {
											setChosen(id)
											onTranslationChange(id)
										}}
									>
										{translationNames[id].short}
									</button>
								))}
							</div>
						</div>
						<div className="insert-feedback">
							{mode === 'search' ? (
								<div className="search-status">
									<p role="status">
										{describeSearch({ state: search.state, shown: hits.length, query })}
									</p>
									<label className="search-scope">
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
						<div
							ref={listbox}
							id="search-results"
							role="listbox"
							aria-label="Matching verses"
							aria-multiselectable="true"
							aria-busy={search.state.kind === 'loading'}
							aria-activedescendant={showResults ? searchOptionId(active) : undefined}
							tabIndex={showResults ? 0 : -1}
							className="search-results"
							data-open={showResults}
							onKeyDown={onResultsKey}
						>
							{showResults && (
								<BibleSearchResults
									groups={groups}
									active={active}
									selected={selected}
									translation={chosen ?? translation}
									onPick={pick}
								/>
							)}
						</div>
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
