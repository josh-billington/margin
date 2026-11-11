import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { openStudy, renameStudy, useStudySession } from '../study/session'
import { iconSm } from '../lib/icons'

export function RenameStudy({
	id,
	title,
	disabled,
	current,
	children,
}: {
	id: string
	title: string
	disabled: boolean
	current: boolean
	children: ReactNode
}) {
	const [value, setValue] = useState(title)
	const [editing, setEditing] = useState(false)
	const titleButton = useRef<HTMLButtonElement>(null)
	const titleInput = useRef<HTMLInputElement>(null)
	const restoreTitleFocus = useRef(false)
	useEffect(() => {
		if (editing) titleInput.current?.select()
		else if (restoreTitleFocus.current) {
			restoreTitleFocus.current = false
			titleButton.current?.focus()
		}
	}, [editing])
	const finish = (save: boolean, restoreFocus: boolean) => {
		if (save && !disabled && useStudySession.getState().currentId === id) renameStudy(value)
		restoreTitleFocus.current = restoreFocus
		setEditing(false)
	}
	const begin = async () => {
		if (disabled) return
		await openStudy(id)
		const state = useStudySession.getState()
		if (state.currentId !== id || state.readOnly || state.closing) return
		setValue(state.sessions[id]?.study.title ?? title)
		setEditing(true)
	}
	return (
		<>
			<button
				ref={titleButton}
				className="row-button"
				hidden={editing}
				aria-current={current ? 'page' : undefined}
				onClick={() => void openStudy(id)}
				onDoubleClick={() => void begin()}
				onKeyDown={(event) => {
					if (event.key === 'F2' && !disabled) {
						event.preventDefault()
						void begin()
					}
				}}
			>
				{title}
			</button>
			{editing && (
				<input
					ref={titleInput}
					autoFocus
					className="field study-title-input"
					aria-label="New study title"
					value={value}
					disabled={disabled}
					onChange={(event) => setValue(event.target.value)}
					onBlur={() => finish(true, false)}
					onKeyDown={(event) => {
						event.stopPropagation()
						if (event.nativeEvent.isComposing) return
						if (event.key === 'Enter' || event.key === 'Escape') {
							event.preventDefault()
							finish(event.key === 'Enter', true)
						}
					}}
				/>
			)}
			<span className="row-actions" hidden={editing}>
				<button
					className="row-icon-button"
					disabled={disabled}
					aria-label={`Rename ${title}`}
					onClick={() => void begin()}
				>
					<Pencil {...iconSm} aria-hidden="true" />
				</button>
				{children}
			</span>
		</>
	)
}
