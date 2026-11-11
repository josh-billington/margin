import { useEffect, useId } from 'react'
import { useEditor, useValue } from 'tldraw'
import { verseKey } from '../highlights/ranges'
import { laidOutVerseBounds } from './actions'
import { computeBrightSet } from './dimming'
import { dimModel } from './model'
import { focusFor, passageLayout, resetFocus, useFocus } from './store'

const DIM = 'var(--focus-dim-opacity, 0.22)'
const OTHER_VERSE = 0.25

/**
 * Runtime-only focus rendering (SPEC §5.2, §9.3): a stylesheet scoped to this canvas dims
 * shapes and non-active verses, so no opacity or highlight prop is ever written. Also draws
 * the faint pulled-out connectors, which are derived from `pulledFrom` and not stored shapes.
 */
export function FocusLayer() {
	const editor = useEditor()
	const scope = useId()
	const owned = useFocus((state) => state.editor === editor)
	const target = useFocus((state) => (state.editor === editor ? state.target : null))
	useEffect(() => {
		const container = editor.getContainer()
		container.setAttribute('data-focus-scope', scope)
		// New input interrupts a camera move (SPEC §5.1).
		const interrupt = () => editor.stopCameraAnimation()
		container.addEventListener('wheel', interrupt, { capture: true, passive: true })
		container.addEventListener('pointerdown', interrupt, true)
		return () => {
			container.removeAttribute('data-focus-scope')
			container.removeEventListener('wheel', interrupt, true)
			container.removeEventListener('pointerdown', interrupt, true)
		}
	}, [editor, scope])
	const gone = useValue(
		'focused passage gone',
		() => !!target && editor.getShape(target.passageId as never)?.type !== 'passage',
		[editor, target],
	)
	useEffect(() => {
		if (gone && focusFor(editor)) resetFocus()
	}, [gone, editor])

	const rules = useValue(
		'focus rules',
		() => {
			if (!target || gone) return ''
			const bright = computeBrightSet(dimModel(editor), target)
			const prefix = `[data-focus-scope="${scope}"]`
			const out = [`${prefix} .tl-shape{transition:opacity 200ms ease-out}`]
			for (const shape of editor.getCurrentPageShapes())
				if (!bright.has(shape.id))
					out.push(`${prefix} [data-shape-id="${shape.id}"]{opacity:${DIM} !important}`)
			if (target.level === 'verse')
				out.push(
					`${prefix} [data-shape-id="${target.passageId}"] .scripture-verse:not([data-verse-key="${verseKey(target.verse)}"]){opacity:${OTHER_VERSE}}`,
				)
			out.push(
				'@media (prefers-reduced-motion: reduce){' +
					`${prefix} .tl-shape,${prefix} .scripture-verse{transition:none}}`,
			)
			return out.join('\n')
		},
		[editor, target, gone, scope],
	)
	const connectors = useValue(
		'pull-out connectors',
		() => {
			passageLayout.get() // Re-measure source verses after any block lays out.
			const bright = target && !gone ? computeBrightSet(dimModel(editor), target) : null
			return editor.getCurrentPageShapes().flatMap((shape) => {
				if (shape.type !== 'passage' || !shape.props.pulledFrom) return []
				const source = editor.getShape(shape.props.pulledFrom.passageId as never)
				if (source?.type !== 'passage') return []
				const from = laidOutVerseBounds(editor, source, shape.props.pulledFrom.verse)
				const x1 = source.x + source.props.width,
					y1 = from.y + from.h / 2,
					x2 = shape.x,
					y2 = shape.y + 28
				const dx = Math.max(24, Math.abs(x2 - x1) / 2)
				return [
					{
						id: shape.id as string,
						d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
						dim: !!bright && !bright.has(shape.id) && !bright.has(source.id),
					},
				]
			})
		},
		[editor, target, gone],
	)
	return (
		<>
			{owned && rules && <style>{rules}</style>}
			{connectors.length > 0 && (
				<svg
					className="pull-out-connectors"
					aria-hidden="true"
					style={{
						position: 'absolute',
						left: 0,
						top: 0,
						width: 1,
						height: 1,
						overflow: 'visible',
						pointerEvents: 'none',
					}}
				>
					{connectors.map((c) => (
						<path
							key={c.id}
							d={c.d}
							fill="none"
							stroke="var(--pen)"
							strokeWidth={1.5}
							strokeDasharray="4 6"
							strokeLinecap="round"
							opacity={c.dim ? 0.08 : 0.3}
						/>
					))}
				</svg>
			)}
		</>
	)
}
