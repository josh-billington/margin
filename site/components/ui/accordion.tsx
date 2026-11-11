'use client'

import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { cn } from '@/lib/utils'

function Accordion(props: React.ComponentProps<typeof AccordionPrimitive.Root>) {
	return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
	return (
		<AccordionPrimitive.Item
			data-slot="accordion-item"
			className={cn(
				'bg-chrome data-[state=open]:bg-surface rounded-2xl transition-colors duration-200',
				className,
			)}
			{...props}
		/>
	)
}

function AccordionTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cn(
					'group flex min-h-16 flex-1 cursor-pointer items-center justify-between gap-6 rounded-2xl px-6 py-4 text-left text-[17px] font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky disabled:pointer-events-none disabled:opacity-50',
					className,
				)}
				{...props}
			>
				{children}
				<span aria-hidden className="relative size-4 shrink-0">
					<span className="bg-muted-foreground absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full" />
					<span className="bg-muted-foreground absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full group-data-[state=open]:rotate-90" />
				</span>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	)
}

function AccordionContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			data-slot="accordion-content"
			className="overflow-hidden"
			{...props}
		>
			<div className={cn('max-w-[60ch] px-6 pb-6 pt-0', className)}>{children}</div>
		</AccordionPrimitive.Content>
	)
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
