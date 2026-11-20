import './tags.css'
import { paletteColorSchema } from '@shared/study/types'
import type { PaletteColor } from '@shared/study/types'

const colorName = (color: string) => color.charAt(0).toUpperCase() + color.slice(1)

/** Swatch picker for colours, shared by the sidebar and the highlight popover. */
export function ColorChoices({
	value,
	onChange,
	label = 'Tag colour',
	ink,
}: {
	value: PaletteColor | null
	onChange: (color: PaletteColor) => void
	label?: string
	ink?: { pressed: boolean; onClick: () => void }
}) {
	return (
		<div className="color-choices" role="group" aria-label={label}>
			{ink && (
				<button
					type="button"
					aria-label="Ink"
					aria-pressed={ink.pressed}
					style={{ background: 'var(--pen)' }}
					onClick={ink.onClick}
				/>
			)}
			{paletteColorSchema.options.map((color) => (
				<button
					key={color}
					type="button"
					aria-label={colorName(color)}
					aria-pressed={value === color}
					style={{ background: `var(--${color})` }}
					onClick={() => onChange(color)}
				/>
			))}
		</div>
	)
}
