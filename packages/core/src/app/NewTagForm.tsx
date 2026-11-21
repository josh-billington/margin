import { useState } from 'react'
import type { PaletteColor } from '@shared/study/types'
import { ColorChoices } from './ColorChoices'

/**
 * The one form for making a tag: a name field, the colour swatches, and a primary button.
 * `stacked` (the sidebar's New tag popover): a labelled field, swatches, then the button.
 * `compact` (a row of the canvas tag popover): the field and a short button side by side, the
 * swatches under them, so it fits where the New tag row was.
 */
export function NewTagForm({
	layout,
	submitLabel,
	onCreate,
}: {
	layout: 'stacked' | 'compact'
	submitLabel: string
	onCreate: (name: string, color: PaletteColor) => void
}) {
	const [name, setName] = useState('')
	const [color, setColor] = useState<PaletteColor>('sky')
	const field = (
		<input
			className="field"
			autoFocus
			value={name}
			placeholder={layout === 'compact' ? 'Tag name' : undefined}
			aria-label={layout === 'compact' ? 'Name' : undefined}
			onChange={(event) => setName(event.target.value)}
		/>
	)
	const submit = (
		<button className="button button-primary" disabled={!name.trim()}>
			{submitLabel}
		</button>
	)
	return (
		<form
			className={`new-tag-form new-tag-${layout}`}
			onSubmit={(event) => {
				event.preventDefault()
				if (!name.trim()) return
				onCreate(name.trim(), color)
				setName('')
			}}
		>
			{layout === 'compact' ? (
				<div className="new-tag-name">
					{field}
					{submit}
				</div>
			) : (
				<label>
					Name
					{field}
				</label>
			)}
			<ColorChoices value={color} onChange={setColor} />
			{layout === 'stacked' && submit}
		</form>
	)
}
