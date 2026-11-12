import { describe, expect, it } from 'vitest'
import { compareVersions, latestRelease } from './versions'

const release = (tag_name: string, draft = false) => ({
	tag_name,
	draft,
	html_url: `https://github.com/josh-billington/margin/releases/tag/${tag_name}`,
})

describe('release versions', () => {
	it.each([
		['0.9.0-beta.9', '0.9.0-beta.10'],
		['0.9.0-beta.10', '0.9.0'],
		['0.9.0', '0.10.0'],
		['0.10.0', '1.0.0'],
		['1.0.0-alpha', '1.0.0-alpha.1'],
		['1.0.0-alpha.1', '1.0.0-alpha.beta'],
		['1.0.0-alpha.beta', '1.0.0-beta'],
		['1.0.0-beta.2', '1.0.0-beta.11'],
		['1.0.0-beta.11', '1.0.0-rc.1'],
		['1.0.0-rc.1', '1.0.0'],
		['1.0.0-999999999999999999999', '1.0.0-1000000000000000000000'],
	])('orders %s before %s', (older, newer) => {
		expect(compareVersions(older, newer)).toBe(-1)
		expect(compareVersions(newer, older)).toBe(1)
	})
	it('ignores the tag prefix and build metadata', () => {
		expect(compareVersions('v0.9.0-beta.1+build.2', '0.9.0-beta.1+other')).toBe(0)
	})
	it.each(['0.09.0', '0.9', '0.9.0-beta.01', '0.9.0-', 'latest', '0.9.0\n'])(
		'rejects invalid version %s',
		(version) => expect(() => compareVersions(version, '0.9.0')).toThrow(),
	)
	it('selects the highest tag, including prereleases, not API order or drafts', () => {
		expect(
			latestRelease([
				release('v1.0.0', true),
				release('not-a-version'),
				release('v0.9.0-beta.9'),
				release('v0.9.0-beta.10'),
				release('v0.8.0'),
			])?.tag_name,
		).toBe('v0.9.0-beta.10')
	})
	it('handles an empty release list', () => {
		expect(latestRelease([])).toBeUndefined()
	})
	it('rejects malformed responses and untrusted download destinations', () => {
		expect(() => latestRelease({ message: 'rate limited' })).toThrow()
		expect(() =>
			latestRelease([{ ...release('v1.0.0'), html_url: 'https://example.com' }]),
		).toThrow()
	})
})
