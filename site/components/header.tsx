'use client'
import Link from 'next/link'
import React from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/logo'
import { DownloadButton } from '@/components/download-button'
import { cn } from '@/lib/utils'
import { useGlassLens } from '@/components/glass-lens'

// A plain bar at the top of the page. Once the page scrolls it floats as a glass capsule, like the
// app's canvas toolbar, over whatever scrolls beneath it.
const menuItems = [
	{ name: 'Questions', href: '/#faq' },
]

export const HeroHeader = () => {
	const [menuState, setMenuState] = React.useState(false)
	const menuButton = React.useRef<HTMLButtonElement>(null)
	const [scrolled, setScrolled] = React.useState(false)
	React.useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 24)
		onScroll()
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])
	// The open phone menu floats too, so its links sit on glass rather than on the page.
	const floating = scrolled || menuState
	// The glass layer keeps one size, so its lens is measured once, not on every frame of a change.
	const lens = useGlassLens<HTMLDivElement>(true)
	React.useEffect(() => {
		if (!menuState) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return
			setMenuState(false)
			menuButton.current?.focus()
		}
		document.addEventListener('keydown', onKeyDown)
		return () => document.removeEventListener('keydown', onKeyDown)
	}, [menuState])
	return (
		<header className="sticky top-0 z-30">
			<nav
				aria-label="Main"
				data-state={menuState ? 'active' : undefined}
				className="relative z-20 flow-root w-full"
			>
				{lens.defs}
				{/* The bar never changes size or position; scrolling only fades its glass in, so nothing
				    reflows and the blur, rim and shadow arrive together. */}
				<div className="header-bar relative mx-auto mt-3 px-3 md:pr-2.5 md:pl-4">
					<div
						aria-hidden
						ref={lens.ref}
						data-on={floating ? '' : undefined}
						className="header-glass glass pointer-events-none absolute inset-0 rounded-2xl"
						{...lens.props}
					/>
					<div className="relative flex flex-wrap items-center justify-between gap-6 py-2 md:gap-0">
						<div className="flex w-full items-center justify-between gap-6 md:w-auto">
							<Link href="/" aria-label="Margin home" className="pressable flex rounded-lg">
								<Logo />
							</Link>

							<button
								ref={menuButton}
								aria-controls="main-menu"
								onClick={() => setMenuState(!menuState)}
								aria-label={menuState ? 'Close menu' : 'Open menu'}
								aria-expanded={menuState}
								className="relative z-20 -m-2.5 -mr-3 block cursor-pointer p-2.5 md:hidden"
							>
								<Menu className="menu-icon in-data-[state=active]:scale-90 in-data-[state=active]:opacity-0 in-data-[state=active]:blur-[2px] m-auto size-6" />
								<X className="menu-icon in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 in-data-[state=active]:blur-none absolute inset-0 m-auto size-6 scale-90 opacity-0 blur-[2px]" />
							</button>
						</div>

						<div
							id="main-menu"
							className="in-data-[state=active]:block md:in-data-[state=active]:flex hidden w-full flex-wrap items-center justify-end gap-6 rounded-2xl p-6 md:flex md:w-fit md:flex-nowrap md:bg-transparent md:p-0"
						>
							<ul className="flex flex-col gap-5 md:flex-row md:gap-1">
								{menuItems.map((item) => (
									<li key={item.name}>
										<Link
											href={item.href}
											onClick={() => setMenuState(false)}
											className={cn(
												'pressable text-ink/75 hover:text-ink flex min-h-11 items-center rounded-lg text-[15px] md:px-3.5 md:py-1.5 md:hover:bg-[var(--glass-fill-hover)]',
											)}
										>
											{item.name}
										</Link>
									</li>
								))}
							</ul>
							<DownloadButton size="sm" />
						</div>
					</div>
				</div>
			</nav>
		</header>
	)
}
