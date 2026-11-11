import Link from 'next/link'
import { Button, type ButtonProps } from '@/components/ui/button'
import { site } from '@/lib/site'

/** "Download for Mac". Until there is a build to download, it says so instead of linking anywhere. */
export function DownloadButton({
	size = 'default',
	className,
}: {
	size?: ButtonProps['size']
	className?: string
}) {
	if (site.downloadUrl)
		return (
			<Button asChild size={size} className={className}>
				<Link href={site.downloadUrl}>Download for Mac</Link>
			</Button>
		)
	return (
		<Button asChild size={size} variant="pending" className={className}>
			<a href="#follow" aria-label="Download for Mac, coming soon">
				Download for Mac
				<span className="text-muted-foreground font-normal">coming soon</span>
			</a>
		</Button>
	)
}

export function FollowLink({ className }: { className?: string }) {
	if (!site.githubUrl) return null
	return (
		<Button asChild variant="ghost" className={className}>
			<a href={site.githubUrl}>
				Follow along on GitHub
				<span aria-hidden>→</span>
			</a>
		</Button>
	)
}
