import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Tailark Mist button, restyled: one shape (pill), flat fills, press feedback.
const buttonVariants = cva(
	'pressable cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium disabled:pointer-events-none aria-disabled:cursor-default [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default: 'bg-sky text-primary-foreground hover:bg-sky-hover',
				soft: 'bg-surface text-ink hover:bg-surface-2',
				pending: 'bg-surface text-ink',
				ghost: 'text-ink/80 hover:text-ink hover:bg-surface',
				link: 'text-ink underline-offset-4 hover:underline',
			},
			size: {
				sm: 'h-11 px-4 md:h-9 text-[15px]',
				default: 'h-11 px-5 text-[15px]',
				lg: 'h-12 px-4 text-[15px] sm:px-6 sm:text-[17px]',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button'
		return (
			<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
		)
	},
)
Button.displayName = 'Button'

export { Button, buttonVariants }
