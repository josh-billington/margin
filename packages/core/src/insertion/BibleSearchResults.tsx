import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import type { Range } from '@tanstack/react-virtual'
import { LoaderCircle } from 'lucide-react'
import { books } from '@shared/bible/books'
import type { BibleSearchHit } from '@shared/bible/search'
import type { BookId, TranslationId } from '@shared/bible/types'
import { iconMd } from '../lib/icons'
import { formatRange, translationNames } from './labels'
import type { SearchList } from './useBibleSearch'

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

/** The next page loads once the rendered rows come this close to the last loaded one. */
const PREFETCH_ROWS = 50
const OVERSCAN = 8

type Row =
	/** `last` is the row of the book's last loaded hit, where its sticky heading lets go. */
	| { kind: 'heading'; book: BookId; total: number; last: number }
	| { kind: 'hit'; hit: number; heading: number }
	/** Holds the spinner or retry while more pages remain. */
	| { kind: 'end' }

/** One flat list: a heading wherever the book changes, so a page boundary never repeats one. */
function flatten(
	hits: SearchList['hits'],
	counts: SearchList['counts'],
	more: boolean,
): { rows: Row[]; rowOfHit: Int32Array } {
	const totals = new Map(counts.books.map(({ book, total }) => [book, total]))
	const rows: Row[] = []
	const rowOfHit = new Int32Array(hits.length)
	let heading = -1
	hits.forEach((hit, index) => {
		const current = rows[heading]
		if (current?.kind !== 'heading' || current.book !== hit.ref.book) {
			heading = rows.length
			rows.push({
				kind: 'heading',
				book: hit.ref.book,
				total: totals.get(hit.ref.book) ?? 0,
				last: 0,
			})
		}
		const row = rows[heading]
		if (row?.kind === 'heading') row.last = rows.length
		rowOfHit[index] = rows.length
		rows.push({ kind: 'hit', hit: index, heading })
	})
	if (more) rows.push({ kind: 'end' })
	return { rows, rowOfHit }
}

const bookNames = new Map(books.map(({ id, name }) => [id, name]))

function Heading({ book, total }: { book: BookId; total: number }) {
	return (
		<>
			{bookNames.get(book)}
			<span>{total.toLocaleString()}</span>
		</>
	)
}

/** Sizes for rows not yet measured, read from a rendered row so they follow width and text size. */
interface Metrics {
	charWidth: number
	lineHeight: number
	padding: number
	minHeight: number
	lineWidth: number
	heading: number
}
const fallbackMetrics: Metrics = {
	charWidth: 6.4,
	lineHeight: 19,
	padding: 8,
	minHeight: 0,
	lineWidth: 360,
	heading: 30,
}
const SAMPLE =
	'And God said, Let there be light: and there was light. For God so loved the world, that he gave'

let measuringCanvas: HTMLCanvasElement | undefined
function readMetrics(scroller: HTMLElement): Metrics | undefined {
	const row = scroller.querySelector<HTMLElement>('.search-hit')
	const text = row?.querySelector<HTMLElement>('.search-hit-text')
	if (!row || !text) return
	const style = getComputedStyle(row)
	const textStyle = getComputedStyle(text)
	const fontSize = parseFloat(textStyle.fontSize)
	measuringCanvas ??= document.createElement('canvas')
	const context = measuringCanvas.getContext('2d')
	if (context)
		context.font = `${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`
	const heading = scroller.querySelector<HTMLElement>('.search-row.search-group-heading')
	const lineHeight = parseFloat(style.lineHeight)
	return {
		charWidth: context ? context.measureText(SAMPLE).width / SAMPLE.length : fontSize * 0.5,
		lineHeight: Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.45,
		padding: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
		minHeight: parseFloat(style.minHeight) || 0,
		// Word wrap leaves ragged line ends: count a line as a little shorter than the row.
		lineWidth:
			(row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) * 0.94,
		heading: heading?.offsetHeight || fallbackMetrics.heading,
	}
}

function DelayedSpinner({ delay = 200 }: { delay?: number }) {
	const [shown, setShown] = useState(false)
	useEffect(() => {
		const timer = setTimeout(() => setShown(true), delay)
		return () => clearTimeout(timer)
	}, [delay])
	return <span className="spinner">{shown && <LoaderCircle {...iconMd} aria-hidden />}</span>
}

interface HitRowProps {
	hit: BibleSearchHit
	index: number
	row: number
	start: number
	setSize: number
	selected: boolean
	active: boolean
	/** Set when the row's translation differs from the one the picker shows. */
	translation: string | undefined
	onPick: (pick: SearchPick) => void
	measure: (node: HTMLElement | null) => void
}

/** Memoized: scrolling re-renders the list's range, not every visible verse. */
const HitRow = memo(function HitRow({
	hit,
	index,
	row,
	start,
	setSize,
	selected,
	active,
	translation,
	onPick,
	measure,
}: HitRowProps) {
	return (
		<div
			ref={measure}
			data-index={row}
			id={searchOptionId(index)}
			role="option"
			aria-selected={selected}
			aria-setsize={setSize}
			aria-posinset={index + 1}
			data-active={active}
			className="search-row search-hit"
			style={{ transform: `translateY(${start}px)` }}
			onMouseDown={(event) => event.preventDefault()}
			onClick={(event) =>
				onPick({
					index,
					kind: event.shiftKey ? 'range' : event.metaKey || event.ctrlKey ? 'toggle' : 'select',
				})
			}
			onDoubleClick={() => onPick({ index, kind: 'add' })}
		>
			<span className="search-hit-ref">
				{formatRange({ start: hit.ref, end: hit.ref })}
				{translation && <span> · {translation}</span>}
			</span>{' '}
			<span className="search-hit-text">
				<VerseSnippet {...hit} />
			</span>
		</div>
	)
})

function useLatest<T>(value: T) {
	const ref = useRef(value)
	useLayoutEffect(() => {
		ref.current = value
	})
	return ref
}

interface RowsProps {
	list: SearchList
	scroller: RefObject<HTMLDivElement | null>
	active: number
	/** Bumped each time the active row should be scrolled into view. */
	reveal: number
	selected: ReadonlySet<number>
	translation: TranslationId
	onPick: (pick: SearchPick) => void
	onLoadMore: () => void
}

/**
 * The virtualized rows of one query's results. Keyed by the query, so a new query starts with a
 * fresh measurement cache at the top of the list. Pages only append, so hit indices (and the
 * selection, which holds them) stay put while more load.
 */
function SearchRows({
	list,
	scroller,
	active,
	reveal,
	selected,
	translation,
	onPick,
	onLoadMore,
}: RowsProps) {
	const { hits, counts } = list
	const more = list.next !== null
	// Rebuilt per page, not per scroll frame: rows only change when hits append.
	const { rows, rowOfHit } = useMemo(() => flatten(hits, counts, more), [hits, counts, more])
	// A new query starts at the top; the listbox is shared with the previous query's rows.
	useLayoutEffect(() => {
		scroller.current?.scrollTo({ top: 0 })
	}, [scroller])
	const metrics = useRef(fallbackMetrics)
	const activeRow = rowOfHit[active] ?? -1
	// The active option is always rendered, so aria-activedescendant names an element that exists.
	const rangeExtractor = useCallback(
		(range: Range) => {
			const indexes = defaultRangeExtractor(range)
			if (activeRow < 0 || activeRow >= range.count || indexes.includes(activeRow)) return indexes
			return [...indexes, activeRow].sort((left, right) => left - right)
		},
		[activeRow],
	)
	const estimateSize = useCallback(
		(index: number) => {
			const row = rows[index]
			const { charWidth, lineHeight, padding, minHeight, lineWidth, heading } = metrics.current
			if (row?.kind === 'heading') return heading
			if (row?.kind !== 'hit') return Math.max(minHeight, lineHeight + padding)
			const hit = hits[row.hit]
			// The reference ("Genesis 1:1") is bold and leads the first line.
			const chars = (hit?.text.length ?? 0) + 14
			const lines = Math.max(1, Math.ceil((chars * charWidth) / Math.max(lineWidth, 1)))
			return Math.max(minHeight, Math.round(lines * lineHeight + padding))
		},
		[rows, hits],
	)
	const getItemKey = useCallback(
		(index: number) => {
			const row = rows[index]
			return row?.kind === 'heading' ? `book:${row.book}` : row?.kind === 'hit' ? row.hit : 'end'
		},
		[rows],
	)
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scroller.current,
		estimateSize,
		overscan: OVERSCAN,
		rangeExtractor,
		initialOffset: 0,
		// Arrowing up to a book's first verse brings its heading into view too.
		scrollPaddingStart: metrics.current.heading,
		getItemKey,
	})
	const items = virtualizer.getVirtualItems()
	const measurements = virtualizer.measurementsCache

	// Unmeasured rows are estimated from the real type and width. Re-estimate when the width
	// changes (the dialog widens with results, the window resizes), keeping the top row in place.
	const recalibrate = useCallback(() => {
		const element = scroller.current
		const next = element && readMetrics(element)
		if (!element || !next) return
		const previous = metrics.current
		metrics.current = next
		if (
			Math.abs(next.lineWidth - previous.lineWidth) < 1 &&
			Math.abs(next.charWidth - previous.charWidth) < 0.05 &&
			next.lineHeight === previous.lineHeight
		)
			return
		const offset = element.scrollTop
		const anchor = virtualizer.getVirtualItemForOffset(offset)
		virtualizer.measure()
		virtualizer.elementsCache.forEach((node) => virtualizer.measureElement(node))
		if (!anchor || offset === 0) return
		virtualizer.getVirtualItems()
		const moved = virtualizer.measurementsCache[anchor.index]
		if (moved) virtualizer.scrollToOffset(moved.start + Math.min(offset - anchor.start, moved.size))
	}, [scroller, virtualizer])

	const hasItems = items.length > 0
	useLayoutEffect(() => {
		if (hasItems) recalibrate()
	}, [hasItems, recalibrate])
	useEffect(() => {
		const element = scroller.current
		if (!element) return
		let width = element.clientWidth
		let timer: ReturnType<typeof setTimeout> | undefined
		const observer = new ResizeObserver(() => {
			if (Math.abs(element.clientWidth - width) < 1) return
			width = element.clientWidth
			// Visible rows re-measure themselves at once; the estimates wait for the width to settle.
			clearTimeout(timer)
			timer = setTimeout(recalibrate, 120)
		})
		observer.observe(element)
		return () => {
			observer.disconnect()
			clearTimeout(timer)
		}
	}, [scroller, recalibrate])

	// Moving the active row (arrows, Home/End, a click) scrolls through the virtualizer, which
	// knows where unrendered rows are. A new list opens at the top instead.
	const revealed = useRef(reveal)
	useEffect(() => {
		if (reveal === revealed.current) return
		revealed.current = reveal
		if (activeRow >= 0) virtualizer.scrollToIndex(activeRow, { align: 'auto' })
	}, [reveal, activeRow, virtualizer])

	const loadMore = useLatest(onLoadMore)
	const end = virtualizer.range?.endIndex ?? -1
	const wantsMore = more && list.more === 'idle' && end >= rows.length - 1 - PREFETCH_ROWS
	useEffect(() => {
		if (wantsMore) loadMore.current()
	}, [wantsMore, hits.length, loadMore])

	const latestPick = useLatest(onPick)
	const pick = useCallback((value: SearchPick) => latestPick.current(value), [latestPick])

	// A sticky heading lives in a box spanning its book's rows, so the next book's heading pushes
	// it off the top just like a native list.
	const sections = new Set<number>()
	for (const item of items) {
		const row = rows[item.index]
		if (row?.kind === 'heading') sections.add(item.index)
		else if (row?.kind === 'hit') sections.add(row.heading)
	}

	return (
		<div className="search-rows" style={{ height: virtualizer.getTotalSize() }}>
			{items.map((item) => {
				const row = rows[item.index]
				if (row?.kind === 'hit') {
					const hit = list.hits[row.hit]
					if (!hit) return null
					return (
						<HitRow
							key={item.key}
							hit={hit}
							index={row.hit}
							row={item.index}
							start={item.start}
							setSize={list.counts.total}
							selected={selected.has(row.hit)}
							active={row.hit === active}
							translation={
								hit.translationId === translation
									? undefined
									: translationNames[hit.translationId].short
							}
							onPick={pick}
							measure={virtualizer.measureElement}
						/>
					)
				}
				if (row?.kind === 'heading')
					return (
						<div
							key={item.key}
							ref={virtualizer.measureElement}
							data-index={item.index}
							className="search-row search-group-heading"
							data-placeholder=""
							role="presentation"
							aria-hidden="true"
							style={{ transform: `translateY(${item.start}px)` }}
						>
							<Heading book={row.book} total={row.total} />
						</div>
					)
				return (
					<div
						key={item.key}
						ref={virtualizer.measureElement}
						data-index={item.index}
						className="search-row search-end"
						role="none"
						style={{ transform: `translateY(${item.start}px)` }}
					>
						{list.more === 'error' ? (
							<p role="alert">
								Couldn’t load more verses.{' '}
								<button
									type="button"
									className="text-button"
									tabIndex={-1}
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => loadMore.current()}
								>
									Try again
								</button>
							</p>
						) : (
							list.more === 'loading' && <DelayedSpinner />
						)}
					</div>
				)
			})}
			{[...sections].map((index) => {
				const row = rows[index]
				const top = measurements[index]
				const bottom = row?.kind === 'heading' ? measurements[row.last] : undefined
				if (row?.kind !== 'heading' || !top || !bottom) return null
				return (
					<div
						key={`section:${row.book}`}
						className="search-section"
						aria-hidden="true"
						style={{ top: top.start, height: bottom.end - top.start }}
					>
						<div className="search-group-heading" onMouseDown={(event) => event.preventDefault()}>
							<Heading book={row.book} total={row.total} />
						</div>
					</div>
				)
			})}
		</div>
	)
}

/**
 * The listbox of matching verses. It is also the scroll container the rows virtualize against,
 * and it stays mounted (closed) so the dialog's height can ease open when results arrive.
 */
export function BibleSearchResults({
	listRef,
	list,
	open,
	busy,
	active,
	reveal,
	selected,
	translation,
	onPick,
	onLoadMore,
	onKeyDown,
}: {
	listRef: RefObject<HTMLDivElement | null>
	list: SearchList | undefined
	open: boolean
	busy: boolean
	active: number
	reveal: number
	selected: ReadonlySet<number>
	/** The translation the picker shows; rows name theirs only when it differs. */
	translation: TranslationId
	onPick: (pick: SearchPick) => void
	onLoadMore: () => void
	onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}) {
	return (
		<div
			ref={listRef}
			id="search-results"
			role="listbox"
			aria-label="Matching verses"
			aria-multiselectable="true"
			aria-busy={busy}
			aria-activedescendant={open ? searchOptionId(active) : undefined}
			tabIndex={open ? 0 : -1}
			className="search-results"
			data-open={open}
			onKeyDown={onKeyDown}
		>
			{open && list && (
				<SearchRows
					key={list.key}
					list={list}
					scroller={listRef}
					active={active}
					reveal={reveal}
					selected={selected}
					translation={translation}
					onPick={onPick}
					onLoadMore={onLoadMore}
				/>
			)}
		</div>
	)
}
