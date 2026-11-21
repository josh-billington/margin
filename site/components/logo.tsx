import { cn } from '@/lib/utils'

/** The keycap mark, contrasting with the page like the download button: light on dark, dark on light. */
const LogoIcon = () => (
	<picture className="flex shrink-0">
		<source srcSet="/logo-keycap-light.svg" media="(prefers-color-scheme: dark)" />
		{/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
		<img src="/logo-keycap-dark.svg" alt="" width={30} height={30} className="size-[30px]" />
	</picture>
)

export const Logo = ({ className }: { className?: string }) => (
	<span className={cn('inline-flex items-center gap-2.5', className)}>
		<LogoIcon />
		<span className="text-ink text-[17px] font-semibold">Margin</span>
	</span>
)
