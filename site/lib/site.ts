/**
 * Launch values. Anything left null renders as an honest "coming soon" state instead of a dead link.
 * Release builds keep constant artifact names, so the download link always serves the newest release.
 */
export const site = {
	name: 'Margin',
	/** Set at build time to the production Pages URL or custom domain. */
	url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://margin-bible.pages.dev',
	description:
		'Make it your own. Map out your study, find connections between verses, notes, and ideas.',
	/** Direct link to the newest .dmg. */
	downloadUrl:
		'https://github.com/josh-billington/margin/releases/latest/download/Margin-arm64.dmg' as
			| string
			| null,
	/** Public repository, for "Follow along". */
	githubUrl: 'https://github.com/josh-billington/margin' as string | null,
	/** Where testers report problems. */
	issuesUrl: 'https://github.com/josh-billington/margin/issues',
	/** Shown under the download button. */
	requirements: 'Free beta for Apple silicon Macs, macOS 12 or later.',
	/** Contact address for privacy questions. */
	contactEmail: null as string | null,
}
