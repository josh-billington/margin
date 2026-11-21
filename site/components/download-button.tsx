'use client'
import React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { site } from '@/lib/site'
import { FaApple, FaGithub } from 'react-icons/fa'

type Navigator = globalThis.Navigator & {
	userAgentData?: { getHighEntropyValues(hints: string[]): Promise<{ architecture?: string }> }
}

/**
 * Whether this is an Intel Mac, where the browser says. Every Mac browser reports "Intel Mac OS X"
 * in its user agent, so only Chromium's client hints can tell; Safari and Firefox stay unknown and
 * get the Apple silicon build, with the Intel link beside it.
 */
function useIntelMac() {
	const [intel, setIntel] = React.useState(false)
	React.useEffect(() => {
		if (!site.intelDownloadUrl) return
		let live = true
		;(navigator as Navigator).userAgentData?.getHighEntropyValues(['architecture']).then(
			(hints) => live && setIntel(hints.architecture === 'x86'),
			() => {},
		)
		return () => {
			live = false
		}
	}, [])
	return intel
}

/** "Download for macOS". Until there is a build to download, it says so instead of linking anywhere. */
export function DownloadButton({
	size = 'default',
	className,
}: {
	size?: ButtonProps['size']
	className?: string
}) {
	const intel = useIntelMac()
	const href = intel ? site.intelDownloadUrl : site.downloadUrl
	if (href)
		return (
			<Button asChild size={size} className={className}>
				<a href={href}>
					<FaApple /> Download for macOS
				</a>
			</Button>
		)
	return (
		<Button asChild size={size} variant="pending" className={className}>
			<a href="#follow" aria-label="Download for macOS">
				<FaApple /> Download for macOS
			</a>
		</Button>
	)
}

/** The Intel build, for browsers that can't say which Mac they're on. Hidden until one is released. */
export function IntelLink({ className, ...props }: React.ComponentProps<'p'>) {
	if (!site.intelDownloadUrl) return null
	return (
		<p {...props} className={`text-ink/60 text-[14px] ${className ?? ''}`}>
			On an Intel Mac?{' '}
			<a
				href={site.intelDownloadUrl}
				className="text-ink/80 hover:text-ink underline underline-offset-4"
			>
				Download for Intel
			</a>
		</p>
	)
}

export function FollowLink({ className }: { className?: string }) {
	if (!site.githubUrl) return null
	return (
		<Button asChild variant="ghost" className={className}>
			<a href={site.githubUrl}>
				Star the repository <FaGithub />
				<span aria-hidden></span>
			</a>
		</Button>
	)
}
