import {
	bdbDisplaySenses,
	bdbMarker,
	bdbMetadata,
	bdbSegmentSeparator,
	type BdbEntry,
	type BdbSegment,
	type BdbSense,
} from '@shared/lexicon/bdb'
import { withReferences } from './references'

function Segments({ text, follow }: { text: BdbSegment[]; follow: (id: string) => void }) {
	return text.map((segment, index) => (
		<span key={index}>
			{bdbSegmentSeparator({ previous: text[index - 1], segment })}
			<span
				className={`lookup-bdb-${segment.kind}`}
				lang={segment.kind === 'hebrew' ? 'he' : undefined}
				dir={segment.kind === 'hebrew' ? 'auto' : undefined}
			>
				{segment.kind === 'text' || segment.kind === 'def'
					? withReferences(segment.text, follow)
					: segment.text}
			</span>
		</span>
	))
}
function InlineSenses({ senses, follow }: { senses: BdbSense[]; follow: (id: string) => void }) {
	return senses.map((sense, index) => (
		<span key={index} className="lookup-sense-inline">
			{index > 0 && '; '}
			<span className="lookup-sense-number">{bdbMarker({ sense, index })}.</span>{' '}
			{sense.label && <span className="lookup-sense-label">{sense.label} </span>}
			<Segments text={sense.text} follow={follow} />
			{sense.senses.length > 0 && (
				<>
					{sense.text.length > 0 && ': '}
					<InlineSenses senses={sense.senses} follow={follow} />
				</>
			)}
		</span>
	))
}

function Senses({
	senses,
	follow,
	depth = 0,
}: {
	senses: BdbSense[]
	follow: (id: string) => void
	depth?: number
}) {
	return (
		<ol className="lookup-senses" role="list">
			{senses.map((sense, index) => {
				const stem = depth === 0 && !!sense.label
				const inline = depth >= 2 && sense.senses.length > 0
				return (
					<li key={index} className={stem ? 'lookup-sense-stem' : undefined}>
						{!stem && <span className="lookup-sense-number">{bdbMarker({ sense, index })}.</span>}
						<div>
							{sense.label && <div className="lookup-sense-label">{sense.label}</div>}
							{(sense.text.length > 0 || inline) && (
								<div>
									<Segments text={sense.text} follow={follow} />
									{inline && (
										<>
											{sense.text.length > 0 && ': '}
											<InlineSenses senses={sense.senses} follow={follow} />
										</>
									)}
								</div>
							)}
							{!inline && sense.senses.length > 0 && (
								<Senses senses={sense.senses} follow={follow} depth={depth + 1} />
							)}
						</div>
					</li>
				)
			})}
		</ol>
	)
}

export function BdbDefinition({
	entries,
	follow,
}: {
	entries: BdbEntry[]
	follow: (id: string) => void
}) {
	return entries.map((entry) => {
		const metadata = bdbMetadata(entry)
		return (
			<section className="lookup-bdb-section" key={entry.id}>
				<h3 className="lookup-bdb-heading">
					{entry.gloss || entry.lemma}
					{metadata && <span className="lookup-bdb-meta"> {metadata}</span>}
				</h3>
				<Senses senses={bdbDisplaySenses(entry)} follow={follow} />
			</section>
		)
	})
}
