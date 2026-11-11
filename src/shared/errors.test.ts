import { describe, expect, it } from 'vitest'
import { UserFacingError, userMessage } from './errors'
import { UnsupportedStudyVersion } from './study/versioning'

describe('user-facing error messages', () => {
	it('preserves an intentional message and its recovery action', () => {
		const message = 'Margin cannot save here. Choose another library folder.'
		expect(userMessage(new UserFacingError(message), 'Try again.')).toBe(message)
	})
	it('does not show file paths, validation details or raw rejected values', () => {
		const fallback = "Margin couldn't open this study. Restore a backup or open another study."
		for (const error of [
			new Error('ENOENT /private/study.json'),
			new SyntaxError('Invalid JSON'),
			'bad schema',
			null,
		]) {
			expect(userMessage(error, fallback)).toBe(fallback)
		}
	})
	it('asks for an update without exposing the study schema version', () => {
		expect(userMessage(new UnsupportedStudyVersion(5), 'Try again.')).toBe(
			'Margin cannot open this study because it needs a newer version of the app. Update Margin and try again.',
		)
	})
})
