import { useState } from 'react'
import type { PaletteColor } from '@shared/study/types'
import { ColorChoices } from './ColorChoices'

/**
 * The one form for making a tag, in the sidebar and in the canvas tag popover: a labelled name
 * field, the colour swatches, and a primary button. Only the button's verb changes.
 */
export function NewTagForm({
	submitLabel,
	onCreate,
}: {
	submitLabel: string
	onCreate: (name: string, color: PaletteColor) => void
}) {
	const [name, setName] = useState('')
	const [color, setColor] = useState<PaletteColor>('sky')
	return (
		<form
			className="new-tag-form"
			onSubmit={(event) => {
				event.preventDefault()
				if (!name.trim()) return
				onCreate(name.trim(), color)
				setName('')
			}}
		>
			<label>
				Name
				<input
					className="field"
					autoFocus
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
			</label>
			<ColorChoices value={color} onChange={setColor} />
			<button className="button button-primary" disabled={!name.trim()}>
				{submitLabel}
			</button>
		</form>
	)
}
