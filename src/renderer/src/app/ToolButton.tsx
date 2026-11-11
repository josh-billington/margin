import * as Tooltip from '@radix-ui/react-tooltip'
import type { ButtonHTMLAttributes } from 'react'

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	label: string
	shortcut?: string
}

export function ToolButton({
	label,
	shortcut,
	children,
	className = '',
	...props
}: ToolButtonProps) {
	return (
		<Tooltip.Root>
			<Tooltip.Trigger asChild>
				<button type="button" className={`icon-button ${className}`} aria-label={label}
					// Keep keyboard focus on the canvas so Space-to-pan and tool keys keep working.
					onMouseDown={(e) => e.preventDefault()}
					{...props}
				>
					{children}
				</button>
			</Tooltip.Trigger>
			<Tooltip.Portal>
				<Tooltip.Content className="tooltip" sideOffset={6}>
					{label}
					{shortcut && <kbd>{shortcut}</kbd>}
				</Tooltip.Content>
			</Tooltip.Portal>
		</Tooltip.Root>
	)
}
