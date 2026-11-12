import { expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: {}, shell: {} }))
import { feedbackUrl } from './help'

it('prefills feedback with an empty title, a short template, and only explicit diagnostics', () => {
	const url = new URL(feedbackUrl('0.9.0-beta.1', '12.7.6', 'arm64'))
	expect(url.origin + url.pathname).toBe('https://github.com/josh-billington/margin/issues/new')
	expect(url.searchParams.get('title')).toBe('')
	expect(url.searchParams.get('body')).toContain('What happened?')
	expect(url.searchParams.get('body')).toContain(
		'Margin: 0.9.0-beta.1\nmacOS: 12.7.6\nArchitecture: arm64',
	)
	expect(url.toString()).not.toContain('\n')
})
