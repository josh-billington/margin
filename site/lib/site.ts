/**
 * Values the owner still has to supply before launch. Anything left null renders as an honest
 * "coming soon" state instead of a dead link.
 */
export const site = {
	name: 'Margin',
	/** Set at build time to the production Pages URL or custom domain. */
	url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://margin-bible.pages.dev',
	description:
		'Make it your own. Map out your study, find connections between verses, notes, and ideas.',
	/** Direct link to the signed .dmg once there is one. */
	downloadUrl: null as string | null,
	/** Public repository or project page, for "Follow along". */
	githubUrl: null as string | null,
	/** Contact address for privacy questions. */
	contactEmail: null as string | null,
}
