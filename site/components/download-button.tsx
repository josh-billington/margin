import { Button, type ButtonProps } from '@/components/ui/button'
import { site } from '@/lib/site'
import { FaApple, FaGithub } from 'react-icons/fa'

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
				<a href={site.downloadUrl}>
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
