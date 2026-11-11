'use client'
import Link from 'next/link'
import React from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/logo'
import { DownloadButton } from '@/components/download-button'
import { cn } from '@/lib/utils'

// Tailark Mist hero header, restyled: a plain bar (wordmark, three links, one action), no blur.
const menuItems = [
	{ name: 'How it works', href: '/#anchors' },
	{ name: 'Features', href: '/#features' },
	{ name: 'Questions', href: '/#faq' },
]

export const HeroHeader = () => {
	const [menuState, setMenuState] = React.useState(false)
	const menuButton = React.useRef<HTMLButtonElement>(null)
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
		<header>
			<nav
				aria-label="Main"
				data-state={menuState ? 'active' : undefined}
				className="relative z-20 w-full"
			>
				<div className="mx-auto max-w-6xl px-6">
					<div className="relative flex flex-wrap items-center justify-between gap-6 py-5 md:gap-0">
						<div className="flex w-full items-center justify-between gap-6 md:w-auto">
							<Link href="/" aria-label="Margin home" className="pressable rounded-lg">
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
								<Menu className="in-data-[state=active]:scale-90 in-data-[state=active]:opacity-0 m-auto size-6" />
								<X className="in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 scale-90 opacity-0" />
							</button>
						</div>

						<div
							id="main-menu"
							className="bg-chrome in-data-[state=active]:block md:in-data-[state=active]:flex hidden w-full flex-wrap items-center justify-end gap-6 rounded-2xl p-6 md:flex md:w-fit md:flex-nowrap md:bg-transparent md:p-0"
						>
							<ul className="flex flex-col gap-5 md:flex-row md:gap-1">
								{menuItems.map((item) => (
									<li key={item.name}>
										<Link
											href={item.href}
											onClick={() => setMenuState(false)}
											className={cn(
												'pressable text-ink/75 hover:text-ink flex min-h-11 items-center rounded-full text-[15px] md:px-3.5 md:py-1.5 md:hover:bg-chrome',
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
