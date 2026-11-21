import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import { translationIdSchema, type TranslationId } from '@shared/bible/types'
import { wordBindingMetadataSchema } from '@shared/study/types'
import type { MappedPassage } from '@shared/ipc/contract'
import {
	formatRange,
	formatRanges,
	translationNames,
	translationOrder,
} from '../../../insertion/labels'
import type { PassageShape } from '../types'
import { wordInkBindings } from '../../bindings/words'

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
	const inFlight = useRef(false)
	function unchanged() {
		const latest = editor.getShape(shape.id)
		return (
			latest?.type === 'passage' &&
			JSON.stringify(latest.props.text) === JSON.stringify(shape.props.text) &&
			!latest.props.highlights.length &&
			!wordInkBindings({ editor, shapeId: shape.id }).length &&
			!editor
				.getBindingsToShape(shape.id, 'arrow')
				.some((binding) => wordBindingMetadataSchema.safeParse(binding.meta).success)
		)
	}

	async function apply(ranges: MappedPassage['ranges']) {
		if (!unchanged()) return
		const result = await window.margin.bible.getPassage({ translationId: target, ranges })
		if (!unchanged()) return
		if (!result.ok) return void toast.error(result.error.message)
		editor.markHistoryStoppingPoint('change translation')
		editor.updateShape({ id: shape.id, type: 'passage', props: { text: result.data } })
		setPending(null)
		setTarget(current)
	}

	async function change(ranges?: MappedPassage['ranges']) {
		if (inFlight.current || !unchanged()) return
		inFlight.current = true
		setBusy(true)
		try {
			if (ranges) {
				await apply(ranges)
				return
			}
			const mapped = await window.margin.bible.mapPassage({
				from: current,
				to: target,
				ranges: shape.props.text.ranges,
			})
			if (!unchanged()) return
			if (!mapped.ok) return void toast.error(mapped.error.message)
			if (mapped.data.kind === 'mapped') await apply(mapped.data.ranges)
			else setPending(mapped.data)
		} catch {
			toast.error('Margin couldn’t change the translation. Try again.')
		} finally {
			inFlight.current = false
			setBusy(false)
		}
	}

	return (
		<div className="translation-control" role="group" aria-label="Translation">
			<div className="translation-current">
				<span>Translation</span>
				<span className="translation-value">{translationNames[current].short}</span>
			</div>
			<select
				className="field"
				aria-label="Change translation to"
				value={target}
				disabled={!!lockReason || busy}
				onChange={(event) => {
					setTarget(translationIdSchema.parse(event.target.value))
					setPending(null)
				}}
			>
				{translationOrder
					.filter((id) => id !== current)
					.map((id) => (
						<option key={id} value={id}>
							{translationNames[id].short}
						</option>
					))}
			</select>
			<button
				type="button"
				className="translation-change"
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
							{translationNames[target].short} splits or combines these verses. Use{' '}
							<strong>{formatRanges(pending.ranges)}</strong>?
						</p>
					) : (
						<p>{translationNames[target].short} has no matching text for some verses.</p>
					)}
					<ul>
						{pending.partialGroups.map((group, i) => (
							<li key={i}>
								{formatRange({ start: group.source[0]!, end: group.source.at(-1)! })} becomes{' '}
								{formatRange({ start: group.target[0]!, end: group.target.at(-1)! })}
							</li>
						))}
						{pending.unmapped.map((item) => (
							<li key={`${item.ref.chapter}:${item.ref.verse}`}>
								{formatRange({ start: item.ref, end: item.ref })}. {item.reason}
							</li>
						))}
					</ul>
					{pending.ranges.length > 0 && (
						<button type="button" disabled={busy} onClick={() => void change(pending.ranges)}>
							{pending.kind === 'incomplete'
								? `Use only ${formatRanges(pending.ranges)}`
								: `Use ${formatRanges(pending.ranges)}`}
						</button>
					)}
					<button type="button" disabled={busy} onClick={() => setPending(null)}>
						Keep {translationNames[current].short}
					</button>
				</div>
			)}
		</div>
	)
}
