import './insert.css'
import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import { translationIdSchema, type TranslationId } from '@shared/bible/types'
import { insertPassage } from '../canvas/tools/commands'
import { Spinner } from '../canvas/lookup/Spinner'
import { blockNoun, formatRanges, translationNames } from './labels'
import { usePreview } from './usePreview'
import type { PreviewState } from './usePreview'

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
	initialQuery: string
	editor: Editor | null
	translation: TranslationId
	oldTestamentTranslation?: TranslationId
	onTranslationChange: (translation: TranslationId) => void
}

function PreviewBody({ state, onPick }: { state: PreviewState; onPick: (value: string) => void }) {
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
			return (
				<div role="alert">
					<p className="insert-error">{state.error.message}</p>
					{state.error.candidates.length > 0 && (
						<ul className="insert-candidates" aria-label="Did you mean">
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
	useEffect(() => {
		if (open) setQuery(initialQuery)
	}, [open, initialQuery])
	// An explicit toggle click outranks the Old Testament default (a qualifier still outranks both).
	const [chosen, setChosen] = useState<TranslationId | null>(null)
	useEffect(() => {
		if (open) setChosen(null)
	}, [open])
	const state = usePreview(
		open ? query : '',
		chosen ?? translation,
		chosen ? undefined : oldTestamentTranslation,
	)
	const resolved = state.status === 'resolved' ? state.preview : null
	// A fallback notice (JPS + NT) asks the reader to confirm the actual translation.
	const switched = !!resolved?.notice && resolved.translation !== (chosen ?? translation)

	async function confirm() {
		if (!resolved || (state.status === 'resolved' && state.stale) || !editor || busy) return
		setBusy(true)
		try {
			const result = await window.margin.bible.getPassage({
				translationId: resolved.translation,
				ranges: resolved.ranges,
			})
			if (!result.ok) return void toast.error(result.error.message)
			insertPassage(editor, result.data)
			onOpenChange(false)
		} finally {
			setBusy(false)
		}
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay palette-overlay" />
				<Dialog.Content
					className="command-dialog insert-dialog"
					aria-describedby="insert-description"
				>
					<Dialog.Title className="insert-title">Add verses</Dialog.Title>
					<Dialog.Description id="insert-description" className="sr-only">
						Type a reference, check the resolved verses, then add them.
					</Dialog.Description>
					<form
						onSubmit={(event) => {
							event.preventDefault()
							void confirm()
						}}
					>
						<div className="insert-row">
							<input
								autoFocus
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Amos 1:3–5"
								aria-label="Reference"
								spellCheck={false}
							/>
							<div role="radiogroup" aria-label="Translation" className="insert-translations">
								{translationIdSchema.options.map((id) => (
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
						<PreviewBody state={state} onPick={setQuery} />
						<div className="insert-actions">
							<button type="button" className="button" onClick={() => onOpenChange(false)}>
								Cancel
							</button>
							<button
								type="submit"
								className="button button-primary"
								disabled={
									!resolved || (state.status === 'resolved' && !!state.stale) || !editor || busy
								}
							>
								{busy
									? 'Adding…'
									: switched && resolved
										? `Use ${translationNames[resolved.translation].short} and add`
										: `Add ${resolved ? blockNoun(resolved.ranges, resolved.translation) : 'verses'}`}
							</button>
						</div>
					</form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
