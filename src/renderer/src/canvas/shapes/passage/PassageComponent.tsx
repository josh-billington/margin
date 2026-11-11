import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { copySelectedScripture } from '../../../insertion/selection'
import { blockTitle } from '../../../insertion/labels'
import { PassageOptions } from './PassageOptions'
import { PassageActions } from './PassageActions'
import { focusPassage, focusVerse } from '../../focus/actions'
import { passageLayout, useFocus } from '../../focus/store'
import { HTMLContainer, useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import type { WordTarget } from '@shared/study/types'
import { highlightAt, verseKey, wordIndex, words, wordKey } from '../../highlights/ranges'
import { applyPlainHighlight } from '../../highlights/applyHighlight'
import { pageTags, TagPopover } from '../../highlights/TagPopover'
import { requestTagSelection, useTagging, wordFor } from '../../highlights/tagging'
import { removeHighlight } from '../../tags/tagOps'
import { useTagFocus } from '../../tags/tagFocus'
import { derived } from '../../bindings/derived'
import { reconcileWords, targetFromElement } from '../../bindings/words'
import { lineBands, unionRect, wordElements } from '../../highlights/bands'
import type { Band } from '../../highlights/bands'
import type { PassageShape } from '../types'

/** Scripture size at 100% scale; the per-block fontScale multiplies it. */
const SCRIPTURE_BASE_PX = 24
type Range = { start: WordTarget; end: WordTarget; x: number; y: number }
export function PassageComponent({ shape, editor }: { shape: PassageShape; editor: Editor }) {
	const root = useRef<HTMLDivElement>(null)
	const textRoot = useRef<HTMLDivElement>(null)
	const [bands, setBands] = useState<Band[]>([])
	const drag = useRef<{ start: WordTarget; end: WordTarget; x: number; y: number } | null>(null)
	const [range, setRange] = useState<Range | null>(null)
	const [optionsOpen, setOptionsOpen] = useState(false)
	const [preview, setPreview] = useState<{ start: WordTarget; end: WordTarget } | null>(null)
	const tool = useValue('tool', () => editor.getCurrentToolId(), [editor])
	const selectedShape = useValue(
		'selected passage',
		() => editor.getSelectedShapeIds().includes(shape.id),
		[editor, shape.id],
	)
	const resize = useRef<{
		clientX: number
		width: number
		x: number
		edge: 'left' | 'right'
	} | null>(null)
	const tags = useValue('page tags', () => pageTags(editor), [editor])
	const request = useTagging((state) =>
		state.request?.passageId === shape.id ? state.request : null,
	)
	const inFocus = useFocus(
		(state) => state.editor === editor && state.target?.passageId === shape.id,
	)
	const focusedTag = useTagFocus((state) => state.tagId)
	const pulse = useTagFocus((state) => state.pulse)
	const currentMatch = useTagFocus((state) => state.currentHighlightId)
	const keyboardSelection = useRef<{ anchor: number; focus: number } | null>(null)
	useEffect(() => {
		if (!request) return
		setRange(request)
		useTagging.setState({ request: null })
	}, [request])
	const { props } = shape
	const indexedWords = useMemo(() => words(props.text), [props.text])
	const indices = useMemo(
		() => new Map(indexedWords.map((word, i) => [wordKey(word), i])),
		[indexedWords],
	)
	const highlighted = useMemo(() => {
		const result = new Map<string, PassageShape['props']['highlights'][number]>()
		for (const highlight of props.highlights) {
			const start = indices.get(wordKey(highlight.start)),
				end = indices.get(wordKey(highlight.end))
			if (start === undefined || end === undefined) continue
			for (const word of indexedWords.slice(start, end + 1)) result.set(wordKey(word), highlight)
		}
		return result
	}, [props.highlights, indexedWords, indices])
	// Keep the words marked while the tag popover is open, so it is clear what is being tagged.
	const marked = preview ?? range
	const previewStart = marked ? wordIndex(props.text, marked.start) : -1
	const previewEnd = marked ? wordIndex(props.text, marked.end) : -1
	const markedLo = Math.min(previewStart, previewEnd),
		markedHi = Math.max(previewStart, previewEnd)
	// The marked words as one band per line, measured from layout (re-measured on reflow).
	useLayoutEffect(() => {
		const text = textRoot.current
		if (!text || markedLo < 0) return setBands([])
		const measure = () => setBands(lineBands(text, wordElements(text, markedLo, markedHi)))
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(text)
		return () => observer.disconnect()
	}, [markedLo, markedHi, props.text])
	useLayoutEffect(() => {
		const element = root.current
		if (!element) return
		let frame = 0
		const measure = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => {
				const current = editor.getShape(shape.id)
				if (current?.type !== 'passage') return
				const h = Math.ceil(element.offsetHeight)
				if (!h) return // Hidden/culling DOM must retain its last measured anchor.
				if (h > 0 && h !== current.props.h)
					derived(editor, () => editor.updateShape({ id: shape.id, type: 'passage', props: { h } }))
				const latest = editor.getShape(shape.id)
				if (latest?.type === 'passage') reconcileWords(editor, latest, element)
				passageLayout.update((n) => n + 1)
			})
		}
		const observer = new ResizeObserver(measure)
		observer.observe(element)
		measure()
		void document.fonts.ready.then(measure)
		return () => {
			observer.disconnect()
			cancelAnimationFrame(frame)
		}
	}, [editor, shape.id, props])
	const update = (patch: Partial<PassageShape['props']>) => {
		editor.markHistoryStoppingPoint('passage options')
		editor.updateShape({ id: shape.id, type: 'passage', props: patch })
	}
	const nearest = (x: number, y: number) => {
		let best: Element | undefined,
			distance = Infinity
		for (const element of root.current?.querySelectorAll('[data-word]') ?? []) {
			const rect = element.getBoundingClientRect()
			const d = Math.hypot(
				Math.max(rect.left - x, 0, x - rect.right),
				Math.max(rect.top - y, 0, y - rect.bottom),
			)
			if (d < distance) {
				best = element
				distance = d
			}
		}
		return best
	}
	const tagSelection = () => {
		requestTagSelection(editor)
	}
	/** Keyboard route into text selection: arrows step by word, Shift extends (SPEC §4.4). */
	const selectByKeyboard = (e: React.KeyboardEvent) => {
		if (e.metaKey || e.ctrlKey || e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight'))
			return false
		const elements = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-word]') ?? [])
		const selection = window.getSelection()
		if (!elements.length || !selection) return false
		const delta = e.key === 'ArrowRight' ? 1 : -1
		let state = keyboardSelection.current
		if (!state) {
			const a = elements.indexOf(wordFor(selection.anchorNode) as HTMLElement),
				f = elements.indexOf(wordFor(selection.focusNode) as HTMLElement)
			state = a >= 0 && f >= 0 && !selection.isCollapsed ? { anchor: a, focus: f } : null
		}
		const next = state
			? Math.min(elements.length - 1, Math.max(0, state.focus + delta))
			: delta > 0
				? 0
				: elements.length - 1
		const anchor = e.shiftKey && state ? state.anchor : next
		keyboardSelection.current = { anchor, focus: next }
		const a = elements[anchor],
			f = elements[next]
		if (!a || !f) return false
		if (anchor <= next) selection.setBaseAndExtent(a, 0, f, f.childNodes.length)
		else selection.setBaseAndExtent(a, a.childNodes.length, f, 0)
		f.scrollIntoView({ block: 'nearest' })
		return true
	}
	return (
		<HTMLContainer style={{ width: props.width, height: props.h, pointerEvents: 'all' }}>
			<div ref={root} className="passage-block" style={{ width: props.width }}>
				{selectedShape &&
					(['left', 'right'] as const).map((edge) => (
						<div
							key={edge}
							className={`passage-resize passage-resize-${edge}`}
							role="separator"
							aria-label={`Resize ${edge} edge`}
							aria-orientation="vertical"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
									e.preventDefault()
									e.stopPropagation()
									update({
										width: Math.max(240, props.width + (e.key === 'ArrowRight' ? 20 : -20)),
									})
								}
							}}
							onPointerDown={(e) => {
								e.stopPropagation()
								e.preventDefault()
								editor.markHistoryStoppingPoint('resize passage')
								resize.current = { clientX: e.clientX, width: props.width, x: shape.x, edge }
								e.currentTarget.setPointerCapture(e.pointerId)
							}}
							onPointerMove={(e) => {
								const initial = resize.current
								if (!initial) return
								const delta = (e.clientX - initial.clientX) / editor.getZoomLevel()
								const width = Math.max(
									240,
									initial.width + (initial.edge === 'right' ? delta : -delta),
								)
								editor.updateShape({
									id: shape.id,
									type: 'passage',
									x: initial.edge === 'left' ? initial.x + initial.width - width : initial.x,
									props: { width },
								})
							}}
							onPointerUp={() => {
								resize.current = null
							}}
							onPointerCancel={() => {
								resize.current = null
							}}
						/>
					))}
				<header className="passage-header" onDoubleClick={() => focusPassage(editor, shape.id)}>
					<span>{blockTitle(props.text.ranges, props.text.edition.translationId)}</span>
					<PassageOptions
						editor={editor}
						shape={shape}
						update={update}
						tagSelection={tagSelection}
						open={optionsOpen}
						onOpenChange={setOptionsOpen}
					>
						<PassageActions editor={editor} shape={shape} onOptions={() => setOptionsOpen(true)} />
					</PassageOptions>
				</header>
				<div
					ref={textRoot}
					className="passage-text"
					tabIndex={0}
					aria-label="Scripture. Arrow keys select words; Shift extends; then use Tag selection."
					aria-description={
						tags.length && props.highlights.some((h) => h.tagId)
							? `Tags in this text: ${[...new Set(props.highlights.map((h) => tags.find((t) => t.id === h.tagId)?.name).filter(Boolean))].join(', ')}`
							: undefined
					}
					style={{ fontSize: SCRIPTURE_BASE_PX * props.fontScale }}
					onCopy={(e) => {
						const copied = copySelectedScripture(root.current, props.text.edition.editionName)
						if (!copied) return // Nothing selected: let the canvas copy the shape.
						e.preventDefault()
						e.stopPropagation()
						e.clipboardData.setData('text/plain', copied)
					}}
					onKeyDown={(e) => {
						e.stopPropagation()
						if (e.nativeEvent.isComposing) return
						if (e.key === 'Escape' && keyboardSelection.current) {
							keyboardSelection.current = null
							window.getSelection()?.removeAllRanges()
						} else if (selectByKeyboard(e)) e.preventDefault()
					}}
					onPointerDown={(e) => {
						keyboardSelection.current = null
						if (tool !== 'select' && tool !== 'highlight') return
						if (e.button !== 0 || editor.inputs.getIsPanning()) return
						e.stopPropagation()
						const element = e.target instanceof Element ? e.target.closest('[data-word]') : null
						if (!element) return
						const target = targetFromElement(element)
						drag.current = { start: target, end: target, x: e.clientX, y: e.clientY }
						if (tool === 'highlight') {
							e.preventDefault()
							e.currentTarget.setPointerCapture(e.pointerId)
							setPreview({ start: target, end: target })
						}
					}}
					onPointerMove={(e) => {
						if (!drag.current) return
						e.stopPropagation()
						if (tool !== 'highlight') return
						const element = nearest(e.clientX, e.clientY)
						if (element) {
							drag.current.end = targetFromElement(element)
							setPreview({ start: drag.current.start, end: drag.current.end })
						}
					}}
					onPointerCancel={() => {
						drag.current = null
						setPreview(null)
					}}
					onPointerUp={(e) => {
						const current = drag.current
						drag.current = null
						setPreview(null)
						if (!current) return
						e.stopPropagation()
						const highlight = highlightAt(props.text, props.highlights, current.start)
						const moved = Math.hypot(e.clientX - current.x, e.clientY - current.y) >= 4
						if (tool === 'select' && e.altKey && moved)
							// Optional ⌥+drag shortcut; same command as the toolbar button.
							requestAnimationFrame(() => requestTagSelection(editor))
						if (tool === 'highlight') {
							e.stopPropagation()
							if (moved || !highlight)
								applyPlainHighlight(editor, shape, current.start, current.end)
							else
								setRange({ start: highlight.start, end: highlight.end, x: e.clientX, y: e.clientY })
						} else if (
							highlight &&
							Math.hypot(e.clientX - current.x, e.clientY - current.y) < 4 &&
							window.getSelection()?.isCollapsed
						)
							setRange({ start: highlight.start, end: highlight.end, x: e.clientX, y: e.clientY })
					}}
				>
					{bands.map((band, i) => (
						<span
							key={i}
							className="range-preview"
							aria-hidden="true"
							style={{ left: band.x, top: band.y, width: band.w, height: band.h }}
						/>
					))}
					{props.text.verses.map((verse) => (
						<span
							key={verseKey(verse.ref)}
							className={
								props.layout === 'verse-per-line' ? 'scripture-verse verse-line' : 'scripture-verse'
							}
							aria-label={verseKey(verse.ref)}
							data-passage-id={shape.id}
							data-verse-key={verseKey(verse.ref)}
						>
							{props.showVerseNumbers && (
								<sup
									className={inFocus ? 'verse-number verse-number-focusable' : 'verse-number'}
									contentEditable={false}
									onClick={() => inFocus && focusVerse(editor, shape.id, verse.ref)}
								>
									{verse.ref.verse}
								</sup>
							)}
							{verse.tokens.map((token) => {
								const target = { verse: verse.ref, token: token.i }
								const highlight = highlighted.get(wordKey(target)),
									tag = tags.find((tag) => tag.id === highlight?.tagId)
								const label = highlight ? (tag?.name ?? 'Highlight') : undefined
								const colour = tag?.color ?? highlight?.color
								return (
									<span key={token.i}>
										<span
											data-word=""
											data-passage-id={shape.id}
											data-verse-ref={verseKey(verse.ref)}
											data-book={verse.ref.book}
											data-chapter={verse.ref.chapter}
											data-verse-number={verse.ref.verse}
											data-token-index={token.i}
											className={[
												'word',
												focusedTag &&
													highlight?.tagId === focusedTag &&
													`tag-emphasis pulse-${pulse % 2}`,
												highlight && highlight.id === currentMatch && 'tag-current',
											]
												.filter(Boolean)
												.join(' ')}
											style={colour ? { fontWeight: 600, color: `var(--${colour})` } : undefined}
											title={label}
											data-tag-name={label}
											aria-label={
												label
													? `${token.runs.map((r) => r.text).join('')}; ${tag ? `tag: ${tag.name}` : 'highlight'}`
													: undefined
											}
											aria-keyshortcuts={highlight ? 'Enter Delete' : undefined}
											tabIndex={highlight ? 0 : undefined}
											onKeyDown={(e) => {
												if (highlight && (e.key === 'Delete' || e.key === 'Backspace')) {
													e.preventDefault()
													removeHighlight(editor, shape, highlight)
												} else if (highlight && e.key === 'Enter') {
													const rect = e.currentTarget.getBoundingClientRect()
													setRange({
														start: highlight.start,
														end: highlight.end,
														x: rect.x,
														y: rect.bottom,
													})
												}
											}}
										>
											{token.leading}
											{token.runs.map((run, i) => (
												<span
													key={i}
													style={{
														fontStyle:
															run.italic && props.showSuppliedWordItalics ? 'italic' : 'normal',
													}}
												>
													{run.text}
												</span>
											))}
											{token.trailing}
										</span>
										{token.spaceAfter}
									</span>
								)
							})}{' '}
						</span>
					))}
				</div>
			</div>
			{range && (
				<TagPopover
					editor={editor}
					shape={shape}
					range={range}
					selectionRect={() => {
						const text = textRoot.current
						const lo = wordIndex(props.text, range.start),
							hi = wordIndex(props.text, range.end)
						return text && lo >= 0 && hi >= 0
							? unionRect(wordElements(text, Math.min(lo, hi), Math.max(lo, hi)))
							: null
					}}
					close={() => setRange(null)}
				/>
			)}
		</HTMLContainer>
	)
}
