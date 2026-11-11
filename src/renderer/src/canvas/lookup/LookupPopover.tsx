import { useEffect, useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { ChevronLeft, Copy } from 'lucide-react'
import { useEditor, useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { toast } from 'sonner'
import type { LexiconEntry, LookupResult, SourceSpan } from '@shared/lexicon/types'
import type { WordTarget } from '@shared/study/types'
import { useLookup } from './store'
import { ManualLookup } from './ManualLookup'
import { addLookupNote } from './addNote'
import { dictionaries } from './dictionaries'
import { Spinner } from './Spinner'
import type { TagRequest } from '../highlights/tagging'
import type { PassageShape } from '../shapes/types'
import { wordKey } from '../highlights/ranges'
import { iconSm } from '../../lib/icons'

function wordElement(editor: Editor, passageId: string, target: WordTarget) {
	return [...editor.getContainer().querySelectorAll<HTMLElement>('[data-word]')].find(
		(element) =>
			element.dataset.passageId === passageId &&
			element.dataset.verseRef ===
				`${target.verse.book}.${target.verse.chapter}.${target.verse.verse}` &&
			element.dataset.tokenIndex === String(target.token),
	)
}

export function LookupOverlay() {
	const editor = useEditor()
	const request = useLookup((state) => (state.editor === editor ? state.request : null))
	const shape = useValue(
		'lookup verse',
		() => editor.getCurrentPageShapes().find((shape) => shape.id === request?.passageId),
		[editor, request],
	)
	return request && shape?.type === 'passage' ? (
		<LookupPopover key={JSON.stringify(request)} editor={editor} shape={shape} request={request} />
	) : null
}

function LookupPopover({
	editor,
	shape,
	request,
}: {
	editor: Editor
	shape: PassageShape
	request: TagRequest
}) {
	const [result, setResult] = useState<LookupResult | null>(null)
	const [entry, setEntry] = useState<LexiconEntry | null>(null)
	const [selected, setSelected] = useState<SourceSpan | null>(null)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(true)
	const [dictionaryId, setDictionaryId] = useState(dictionaries[0]?.id ?? '')
	/** Entries left by following a cross-reference, newest last. */
	const [trail, setTrail] = useState<LexiconEntry[]>([])
	const sequence = useRef(0)
	const target = selected ? { verse: selected.ref, token: selected.first } : request.start
	const currentTarget = useRef(target)
	currentTarget.current = target
	const close = () => {
		if (useLookup.getState().request !== request) return
		useLookup.setState({ request: null })
		wordElement(editor, shape.id, currentTarget.current)
			?.closest<HTMLElement>('.passage-text')
			?.focus({ preventScroll: true })
	}
	const closeRef = useRef(close)
	closeRef.current = close
	const anchor = useMemo(
		() => ({
			current: {
				getBoundingClientRect: () =>
					wordElement(editor, shape.id, currentTarget.current)?.getBoundingClientRect() ??
					new DOMRect(request.x, request.y, 0, 0),
			},
		}),
		[editor, shape.id, request.x, request.y],
	)
	const collisionPadding = useMemo(
		() => ({
			top: (document.querySelector('.title-bar')?.getBoundingClientRect().bottom ?? 0) + 8,
			bottom: 76,
			left: 8,
			right: 8,
		}),
		[],
	)
	useEffect(() => {
		let frame = 0
		let marked: HTMLElement | null = null
		const check = () => {
			const element = wordElement(editor, shape.id, currentTarget.current)
			if (element !== marked) {
				marked?.classList.remove('lookup-target')
				element?.classList.add('lookup-target')
				marked = element ?? null
			}
			const rect = element?.getBoundingClientRect()
			const viewport = editor.getViewportScreenBounds()
			if (
				getComputedStyle(editor.getContainer()).visibility === 'hidden' ||
				!rect ||
				rect.bottom < Math.max(viewport.y, collisionPadding.top) ||
				rect.top > viewport.maxY ||
				rect.right < viewport.x ||
				rect.left > viewport.maxX
			)
				return closeRef.current()
			frame = requestAnimationFrame(check)
		}
		frame = requestAnimationFrame(check)
		return () => {
			cancelAnimationFrame(frame)
			marked?.classList.remove('lookup-target')
		}
	}, [editor, shape.id, collisionPadding])
	const lookup = async (id: string, from?: LexiconEntry) => {
		const ticket = ++sequence.current
		setBusy(true)
		setError('')
		try {
			const response = await window.margin.lexicon.getEntry({ id })
			if (ticket !== sequence.current) return
			if (!response.ok) setError(response.error.message)
			else if (!response.data) setError(`No bundled entry for ${id}. Try another Strong’s number.`)
			else {
				if (from) setTrail((trail) => [...trail, from])
				setEntry(response.data)
			}
		} catch {
			if (ticket === sequence.current) setError('The dictionary could not be read. Try again.')
		} finally {
			if (ticket === sequence.current) setBusy(false)
		}
	}
	useEffect(() => {
		let active = true
		void window.margin.lexicon
			.lookupSelection({ text: shape.props.text, start: request.start, end: request.end })
			.then((response) => {
				if (!active) return
				setBusy(false)
				if (!response.ok) return setError(response.error.message)
				setResult(response.data)
				const span = response.data.spans[0]
				if (
					wordKey(request.start) === wordKey(request.end) &&
					span &&
					span.first === span.last &&
					span.ids.length === 1
				) {
					setSelected(span)
					void lookup(span.ids[0] ?? '')
				}
			})
			.catch(() => {
				if (active) {
					setBusy(false)
					setError('The dictionary could not be read. Try again.')
				}
			})
		return () => {
			active = false
			sequence.current++
		}
		// The request key remounts this component for every new lookup.
	}, [])
	const token = shape.props.text.verses.find(
		(verse) =>
			verse.ref.book === request.start.verse.book &&
			verse.ref.chapter === request.start.verse.chapter &&
			verse.ref.verse === request.start.verse.verse,
	)?.tokens[request.start.token]
	const english = selected?.text ?? token?.runs.map((run) => run.text).join('') ?? ''
	const supplied = token?.runs.length && token.runs.every((run) => run.italic)
	const choices = result?.spans.flatMap((span) => span.ids.map((id) => ({ span, id }))) ?? []
	const canGoBack = choices.length > 1 || (!!selected && selected.first !== selected.last)
	const previous = trail.at(-1)
	const follow = (id: string) => {
		if (!entry || id === entry.id) return
		void lookup(id, entry)
	}
	const back = () => {
		sequence.current++
		setBusy(false)
		setError('')
		if (previous) {
			setTrail(trail.slice(0, -1))
			setEntry(previous)
			return
		}
		setEntry(null)
		setSelected(null)
	}
	const available = entry ? dictionaries.filter((dictionary) => dictionary.appliesTo(entry)) : []
	const dictionary =
		available.find((dictionary) => dictionary.id === dictionaryId) ?? available[0] ?? null
	const hebrew = entry?.id.startsWith('H')
	const message =
		result?.status === 'unsupported-translation'
			? 'Word lookup is available for KJV. Look up a Strong’s number'
			: result?.status === 'snapshot-mismatch'
				? 'Source tags are unavailable because this verse snapshot differs from the recorded edition or tokenizer. Look up a Strong’s number.'
				: supplied
					? 'No source word — added in translation'
					: 'No source tag for this word'
	return (
		<Popover.Root
			open
			onOpenChange={(open) => {
				if (!open) close()
			}}
		>
			<Popover.Anchor virtualRef={anchor} />
			<Popover.Portal>
				<Popover.Content
					className="margin-popover lookup-popover"
					side="bottom"
					align="start"
					sideOffset={8}
					collisionPadding={collisionPadding}
					updatePositionStrategy="always"
					aria-label="Word lookup"
					onPointerDown={(event) => event.stopPropagation()}
					onOpenAutoFocus={(event) => {
						event.preventDefault()
						if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
					}}
					onCloseAutoFocus={(event) => {
						event.preventDefault()
						closeRef.current()
					}}
				>
					<header className="lookup-header">
						{entry ? (
							<>
								{(previous || canGoBack) && (
									<button className="lookup-back" onClick={back}>
										<ChevronLeft {...iconSm} />
										{previous ? (
											<span lang={previous.id.startsWith('H') ? 'he' : 'grc'} dir="auto">
												{previous.lemma}
											</span>
										) : (
											'Source words'
										)}
									</button>
								)}
								<div className="lookup-headword">
									<span lang={hebrew ? 'he' : 'grc'} dir={hebrew ? 'rtl' : 'ltr'}>
										{entry.lemma}
									</span>
									{busy ? (
										<Spinner label="Looking up word" />
									) : (
										<span className="lookup-id">{entry.id}</span>
									)}
								</div>
								<div className="lookup-subtitle">
									<span className="lookup-transliteration">{entry.transliteration}</span>
									{english && !previous && (
										<span className="lookup-muted">
											{' · translated '}
											<span
												className={supplied ? 'lookup-english lookup-supplied' : 'lookup-english'}
											>
												{english}
											</span>
										</span>
									)}
								</div>
							</>
						) : (
							<strong>Look up {english ? `“${english}”` : 'word'}</strong>
						)}
					</header>
					{dictionary && available.length > 1 && (
						<ToggleGroup.Root
							type="single"
							className="toggle-row lookup-dictionaries"
							aria-label="Dictionary"
							value={dictionary.id}
							onValueChange={(id) => id && setDictionaryId(id)}
						>
							{available.map(({ id, label }) => (
								<ToggleGroup.Item key={id} value={id}>
									{label}
								</ToggleGroup.Item>
							))}
						</ToggleGroup.Root>
					)}
					<div className="lookup-body" aria-busy={busy}>
						{busy && !entry && (
							<div className="lookup-loading">
								<Spinner label="Looking up word" />
							</div>
						)}
						{error && <p role="alert">{error}</p>}
						{entry ? (
							<>{dictionary && <dictionary.Body key={entry.id} entry={entry} follow={follow} />}</>
						) : (
							!busy && (
								<>
									{choices.length ? (
										<div className="lookup-choices" aria-label="Source words">
											{choices.map(({ span, id }, index) => (
												<button
													key={index}
													onClick={() => {
														setSelected(span)
														void lookup(id)
													}}
												>
													<span>{span.text}</span>
													<span className="lookup-muted">{id} · Strong’s</span>
												</button>
											))}
										</div>
									) : (
										<p>{message}</p>
									)}
									<ManualLookup
										lookup={(id) => {
											setSelected(null)
											void lookup(id)
										}}
									/>
								</>
							)
						)}
					</div>
					{entry && (
						<footer className="lookup-actions">
							<span className="lookup-source">{dictionary?.name(entry)}</span>
							<button
								className="icon-button"
								aria-label="Copy"
								title="Copy definition"
								disabled={!dictionary}
								onClick={() =>
									dictionary
										?.copy(entry)
										.catch((error: unknown) =>
											toast.error(
												error instanceof Error
													? error.message
													: 'Could not copy the definition. Try again.',
											),
										)
								}
							>
								<Copy {...iconSm} />
							</button>
							<button
								className="button"
								disabled={busy || !dictionary}
								onClick={() => {
									const element = wordElement(editor, shape.id, target)
									if (element && dictionary) {
										addLookupNote(editor, shape, target, element, dictionary.noteText(entry))
										close()
									}
								}}
							>
								Add note
							</button>
						</footer>
					)}
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	)
}
