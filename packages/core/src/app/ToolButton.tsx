import * as Tooltip from '@radix-ui/react-tooltip'
import type { ButtonHTMLAttributes } from 'react'

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** Accessible name; also the tooltip unless `tip` is given. */
	label: string
	/** A shorter tooltip when the name carries context ("Rename" for "Rename Psalm study"). */
	tip?: string
	shortcut?: string
	/** The small sidebar-row size instead of the 26px toolbar size. */
	row?: boolean
}

export function ToolButton({
	label,
	tip,
	shortcut,
	row = false,
	children,
	className = '',
	...props
}: ToolButtonProps) {
	return (
		<Tooltip.Root>
			<Tooltip.Trigger asChild>
				<button
					type="button"
					className={`${row ? 'row-icon-button' : 'icon-button'} ${className}`}
					aria-label={label}
					// Keep keyboard focus on the canvas so Space-to-pan and tool keys keep working.
					onMouseDown={(e) => e.preventDefault()}
					{...props}
				>
					{children}
				</button>
			</Tooltip.Trigger>
			<Tooltip.Portal>
				<Tooltip.Content className="tooltip" sideOffset={6}>
					{tip ?? label}
					{shortcut && <kbd>{shortcut}</kbd>}
				</Tooltip.Content>
			</Tooltip.Portal>
		</Tooltip.Root>
	)
}
