import { useState } from 'react'
import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import { translationIdSchema, type TranslationId } from '@shared/bible/types'
import type { MappedPassage } from '@shared/ipc/contract'
import { formatRange, formatRanges, translationNames } from '../../../insertion/labels'
import type { PassageShape } from '../types'

/** Unannotated blocks change translation only through the versification map, never by guessing. */
export function TranslationControl({
	editor,
	shape,
	lockReason,
}: {
	editor: Editor
	shape: PassageShape
	lockReason: string | null
}) {
	const current = shape.props.text.edition.translationId
	const [target, setTarget] = useState<TranslationId>(current === 'kjv' ? 'jps1917' : 'kjv')
	const [pending, setPending] = useState<MappedPassage | null>(null)
	const [busy, setBusy] = useState(false)

	async function apply(ranges: MappedPassage['ranges']) {
		const latest = editor.getShape(shape.id)
		if (latest?.type !== 'passage' || latest.props.highlights.length) return
		const result = await window.margin.bible.getPassage({ translationId: target, ranges })
		if (!result.ok) return void toast.error(result.error.message)
		editor.markHistoryStoppingPoint('change translation')
		editor.updateShape({ id: shape.id, type: 'passage', props: { text: result.data } })
		setPending(null)
		setTarget(current)
	}

	async function change() {
		setBusy(true)
		try {
			const mapped = await window.margin.bible.mapPassage({
				from: current,
				to: target,
				ranges: shape.props.text.ranges,
			})
			if (!mapped.ok) return void toast.error(mapped.error.message)
			if (mapped.data.kind === 'mapped') await apply(mapped.data.ranges)
			else setPending(mapped.data)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="translation-control" role="group" aria-label="Translation">
			<span>Translation: {translationNames[current].short}</span>
			<select
				aria-label="Change translation to"
				value={target}
				disabled={!!lockReason || busy}
				onChange={(event) => {
					setTarget(translationIdSchema.parse(event.target.value))
					setPending(null)
				}}
			>
				{translationIdSchema.options
					.filter((id) => id !== current)
					.map((id) => (
						<option key={id} value={id}>
							{translationNames[id].short}
						</option>
					))}
			</select>
			<button
				type="button"
				disabled={!!lockReason || busy}
				aria-describedby={lockReason ? 'translation-lock' : undefined}
				onClick={() => void change()}
			>
				{busy ? 'Changing…' : `Change to ${translationNames[target].short}`}
			</button>
			{lockReason && (
				<small id="translation-lock" className="insert-hint">
					{lockReason}
				</small>
			)}
			{pending && (
				<div className="translation-options" role="alert">
					{pending.kind === 'confirmation-required' ? (
						<p>
							These verses split or merge in {translationNames[target].short}. Resolved to{' '}
							<strong>{formatRanges(pending.ranges)}</strong>:
						</p>
					) : (
						<p>Some verses have no equivalent in {translationNames[target].short}:</p>
					)}
					<ul>
						{pending.partialGroups.map((group, i) => (
							<li key={i}>
								{formatRange({ start: group.source[0]!, end: group.source.at(-1)! })} →{' '}
								{formatRange({ start: group.target[0]!, end: group.target.at(-1)! })}
							</li>
						))}
						{pending.unmapped.map((item) => (
							<li key={`${item.ref.chapter}:${item.ref.verse}`}>
								{formatRange({ start: item.ref, end: item.ref })}: {item.reason}
							</li>
						))}
					</ul>
					{pending.ranges.length > 0 && (
						<button type="button" onClick={() => void apply(pending.ranges)}>
							{pending.kind === 'incomplete'
								? `Use only ${formatRanges(pending.ranges)}`
								: `Use ${formatRanges(pending.ranges)}`}
						</button>
					)}
					<button type="button" onClick={() => setPending(null)}>
						Keep {translationNames[current].short}
					</button>
				</div>
			)}
		</div>
	)
}
