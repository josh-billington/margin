import { z } from 'zod'

const numeric = '(0|[1-9][0-9]*)'
const identifier = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
const versionPattern = new RegExp(
	`^v?${numeric}\\.${numeric}\\.${numeric}(?:-(${identifier}(?:\\.${identifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?![\\s\\S])`,
)

function parseVersion(version: string) {
	const match = versionPattern.exec(version)
	if (!match) throw new Error('Invalid release version')
	return { core: match.slice(1, 4), prerelease: match[4]?.split('.') }
}

function compareIdentifier(left: string, right: string) {
	const leftNumeric = /^\d+$/.test(left)
	const rightNumeric = /^\d+$/.test(right)
	if (leftNumeric && rightNumeric && left.length !== right.length)
		return left.length > right.length ? 1 : -1
	if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
	return left === right ? 0 : left > right ? 1 : -1
}

export function compareVersions(left: string, right: string): number {
	const first = parseVersion(left)
	const second = parseVersion(right)
	for (const [index, part] of first.core.entries()) {
		const comparison = compareIdentifier(part, second.core[index]!)
		if (comparison) return comparison
	}
	if (!first.prerelease || !second.prerelease)
		return first.prerelease ? -1 : second.prerelease ? 1 : 0
	for (const [index, part] of first.prerelease.entries()) {
		const other = second.prerelease[index]
		if (other === undefined) return 1
		const comparison = compareIdentifier(part, other)
		if (comparison) return comparison
	}
	return first.prerelease.length < second.prerelease.length ? -1 : 0
}

const releasesSchema = z.array(
	z.object({ draft: z.boolean(), tag_name: z.string(), html_url: z.url() }),
)

export function latestRelease(input: unknown) {
	return releasesSchema
		.parse(input)
		.reduce<z.infer<typeof releasesSchema>[number] | undefined>((latest, release) => {
			if (release.draft || !versionPattern.test(release.tag_name)) return latest
			const url = new URL(release.html_url)
			if (
				url.origin !== 'https://github.com' ||
				url.username ||
				url.password ||
				!url.pathname.startsWith('/josh-billington/margin/releases/tag/')
			)
				throw new Error('Invalid release URL')
			return !latest || compareVersions(release.tag_name, latest.tag_name) > 0 ? release : latest
		}, undefined)
}
