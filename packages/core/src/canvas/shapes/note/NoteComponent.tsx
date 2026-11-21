import { useLayoutEffect, useRef, useState } from 'react'
import { HTMLContainer, useValue } from 'tldraw'
import type { Editor } from 'tldraw'
import { derived } from '../../bindings/derived'
import type { NoteShape } from '../types'
import { noteSizes } from './NoteShapeUtil'
import { NoteOptions } from './NoteOptions'
import { parseEmphasis, stripEmphasis } from './emphasis'
import { usePreferences } from '../../../lib/preferences'
import { revealShape } from '../../focus/actions'
import { NOTE_INK_HEIGHT, NOTE_INK_INSET, NOTE_INK_WIDTH, noteInkHeight } from '../../ink/notePad'
import { strokePath } from '../../ink/stroke'

/**
 * A note sizes itself to its text up to a margin-note measure, then wraps: about 320px at the
 * default size, in ems so larger note text keeps the same number of words to a line.
 */
const NOTE_MEASURE = '14.5em'

type NoteComponentProps = { shape: NoteShape; editor: Editor }

export function NoteComponent({ shape, editor }: NoteComponentProps) {
	const showPad = shape.props.strokes.length > 0
	const editing = useValue('editing note', () => editor.getEditingShapeId() === shape.id, [
		editor,
		shape.id,
	])
	const selected = useValue(
		'selected note',
		() => editor.getSelectedShapeIds().includes(shape.id),
		[editor, shape.id],
	)
	const [draft, setDraft] = useState(shape.props.text)
	const measure = useRef<HTMLDivElement>(null)
	const input = useRef<HTMLTextAreaElement>(null)
	useLayoutEffect(() => {
		if (!editing) return
		const current = editor.getShape(shape.id)
		const text = current?.type === 'margin-note' ? current.props.text : ''
		// Re-editing starts its own undo step. A new note's first text stays in its creation step,
		// so one undo removes the whole note (and an arrow created with it).
		if (text) editor.markHistoryStoppingPoint('edit note')
		setDraft(text)
		// A double-click starts editing inside mousedown; focusing now would lose focus to the
		// browser's own mousedown focus handling (blur → editing ends). Focus next frame.
		const frame = requestAnimationFrame(() => {
			const element = input.current
			if (!element) return
			element.focus()
			element.setSelectionRange(element.value.length, element.value.length)
		})
		return () => cancelAnimationFrame(frame)
	}, [editing, editor, shape.id])
	// Text is written to the note as it is typed (like tldraw's own text), so it survives however
	// editing ends — clicking the canvas unmounts the textarea before it ever blurs.
	const change = (text: string) => {
		setDraft(text)
		editor.updateShape({ id: shape.id, type: 'margin-note', props: { text } })
	}
	useLayoutEffect(() => {
		const element = measure.current
		if (!element) return
		let frame = 0
		const resize = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => {
				const current = editor.getShape(shape.id)
				if (current?.type !== 'margin-note' || !element.offsetHeight) return
				// +2px slack: scrollWidth rounds down, and a textarea a hair narrower than its text wraps and scrolls.
				const w = Math.ceil(
					current.props.width ?? Math.max(showPad ? 264 : 100, element.scrollWidth + 10),
				)
				const h =
					Math.max(36, Math.ceil(element.offsetHeight + 8)) +
					(showPad ? Math.ceil(noteInkHeight(w)) + NOTE_INK_INSET : 0)
				if (w === current.props.w && h === current.props.h) return
				derived(editor, () =>
					editor.updateShape({ id: shape.id, type: 'margin-note', props: { w, h } }),
				)
				// A note growing while it is typed into keeps its text in view.
				if (editor.getEditingShapeId() === shape.id) revealShape(editor, shape.id)
			})
		}
		const observer = new ResizeObserver(resize)
		observer.observe(element)
		resize()
		void document.fonts.ready.then(resize)
		return () => {
			observer.disconnect()
			cancelAnimationFrame(frame)
		}
	}, [shape, draft, editing, editor, showPad])
	const commit = () => editor.setEditingShape(null)
	const plainDisplay = usePreferences((state) => state.displayNotesInPlainFont)
	const text = editing ? draft : stripEmphasis(shape.props.text)
	return (
		<HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}>
			<div
				className="margin-note"
				style={{
					width: shape.props.w,
					height: shape.props.h,
					fontFamily:
						shape.props.font === 'handwritten' && !plainDisplay
							? 'var(--font-hand)'
							: 'var(--font-ui)',
					fontSize: noteSizes[shape.props.size],
					// Default note ink is the pen colour, shared with arrows.
					color: `var(--${shape.props.color === 'ink' ? 'pen' : shape.props.color})`,
				}}
			>
				<div
					ref={measure}
					aria-hidden
					style={{
						position: 'absolute',
						visibility: 'hidden',
						width: shape.props.width ? shape.props.width - 8 : 'max-content',
						maxWidth: shape.props.width ? undefined : NOTE_MEASURE,
						whiteSpace: 'pre-wrap',
					}}
				>
					{text || ' '}
					{'\u200b'}
				</div>
				{editing ? (
					<textarea
						ref={input}
						aria-label="Note text"
						value={draft}
						style={
							showPad ? { height: shape.props.h - noteInkHeight(shape.props.w) - 24 } : undefined
						}
						onChange={(e) => change(e.target.value)}
						onBlur={commit}
						onPointerDown={(e) => e.stopPropagation()}
						onKeyDown={(e) => {
							e.stopPropagation()
							if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
								commit()
								e.currentTarget.blur()
							}
						}}
					/>
				) : (
					<span>
						{shape.props.text
							? parseEmphasis(shape.props.text).map((segment, i) =>
									segment.emphasis ? <em key={i}>{segment.text}</em> : segment.text,
								)
							: showPad
								? null
								: 'Write a note…'}
					</span>
				)}
				{showPad && (
					<svg
						data-note-ink={shape.id}
						aria-label="Handwriting"
						role="img"
						viewBox={`0 0 ${NOTE_INK_WIDTH} ${NOTE_INK_HEIGHT}`}
						width={shape.props.w - NOTE_INK_INSET * 2}
						height={noteInkHeight(shape.props.w)}
						fill="currentColor"
						style={{
							position: 'absolute',
							left: NOTE_INK_INSET,
							bottom: NOTE_INK_INSET,
							overflow: 'hidden',
						}}
					>
						{shape.props.strokes.map((points, index) => (
							<path key={index} d={strokePath({ points })} />
						))}
					</svg>
				)}
				{selected && !editing && <NoteOptions editor={editor} shape={shape} />}
			</div>
		</HTMLContainer>
	)
}
