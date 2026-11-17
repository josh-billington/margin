import { useId } from 'react'
import * as Slider from '@radix-ui/react-slider'

/** The one slider: a label with its value on the right, and a Radix track below. */
export function SliderField({
	label,
	value,
	format,
	min,
	max,
	step,
	onChange,
	onCommit,
}: {
	label: string
	value: number
	format: (value: number) => string
	min: number
	max: number
	step: number
	onChange: (value: number) => void
	onCommit?: (value: number) => void
}) {
	const id = useId()
	return (
		<div className="slider-field">
			<div className="slider-label">
				<span id={id}>{label}</span>
				<output aria-hidden="true">{format(value)}</output>
			</div>
			<Slider.Root
				className="slider-root"
				min={min}
				max={max}
				step={step}
				value={[value]}
				onValueChange={([next]) => next !== undefined && onChange(next)}
				onValueCommit={([next]) => next !== undefined && onCommit?.(next)}
			>
				<Slider.Track className="slider-track">
					<Slider.Range className="slider-range" />
				</Slider.Track>
				<Slider.Thumb
					className="slider-thumb"
					aria-labelledby={id}
					aria-valuetext={format(value)}
				/>
			</Slider.Root>
		</div>
	)
}
