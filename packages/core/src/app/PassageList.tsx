import { Focus, Plus } from 'lucide-react'
import { useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { centerOn } from '../canvas/focus/camera'
import { focusPassage, moveCamera } from '../canvas/focus/actions'
import { orderPassages } from '../canvas/focus/passageOrder'
import { blockTitle } from '../insertion/labels'
import { iconMd, iconSm } from '../lib/icons'
import { ToolButton } from './ToolButton'
import { runCommand, titleFor } from './commands'

/** SPEC §6.2: passages in scripture order (not canvas order) for keyboard and screen-reader use. */
export function PassageList({ editor }: { editor: Editor | null }) {
	const items = useValue(
		'passage list',
		() => {
			if (!editor) return []
			return orderPassages(
				editor.getCurrentPageShapes().flatMap((shape) =>
					shape.type === 'passage'
						? [
								{
									id: shape.id,
									x: shape.x,
									y: shape.y,
									first: shape.props.text.verses[0]?.ref,
									label: blockTitle(
										shape.props.text.ranges,
										shape.props.text.edition.translationId,
									),
									pulledOut: !!shape.props.pulledFrom,
								},
							]
						: [],
				),
			)
		},
		[editor],
	)
	if (!editor) return null
	const readOnly = editor.getIsReadonly()
	const pan = (id: (typeof items)[number]['id']) => {
		const shape = editor.getShape(id)
		if (shape?.type !== 'passage') return
		editor.select(id)
		const { w, h } = editor.getViewportScreenBounds()
		moveCamera(
			editor,
			centerOn(
				{ w, h },
				{ x: shape.x + shape.props.width / 2, y: shape.y + shape.props.h / 2 },
				editor.getZoomLevel(),
			),
		)
	}
	return (
		<section aria-labelledby="verses-heading">
			<div className="section-heading">
				<h2 id="verses-heading">Verses</h2>
				<ToolButton
					label={titleFor('passage.add')}
					onClick={() => runCommand('passage.add')}
					disabled={readOnly}
				>
					<Plus {...iconMd} aria-hidden="true" />
				</ToolButton>
			</div>
			{items.length === 0 ? (
				<p className="sidebar-hint">Verses you add appear here in Bible order.</p>
			) : (
				<ol className="passage-list" aria-label="Verses in Bible order">
					{items.map((item) => (
						<li key={item.id} className="passage-list-row">
							<button className="row-button" onClick={() => pan(item.id)}>
								{item.label}
								{item.pulledOut && <span className="sr-only"> (pulled-out verse)</span>}
							</button>
							<ToolButton
								row
								label={`Focus ${item.label}`}
								tip="Focus"
								shortcut="F"
								onClick={() => focusPassage(editor, item.id)}
							>
								<Focus {...iconSm} aria-hidden="true" />
							</ToolButton>
						</li>
					))}
				</ol>
			)}
		</section>
	)
}
