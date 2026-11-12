import { app, shell } from 'electron'
import { join } from 'node:path'
import { logEvent, logFailure } from './logger'

export const WEBSITE = 'https://margin-bible.pages.dev'

export function feedbackUrl(version: string, systemVersion: string, arch: string) {
	const url = new URL('https://github.com/josh-billington/margin/issues/new')
	url.searchParams.set('title', '')
	url.searchParams.set(
		'body',
		`What happened?\n\nWhat did you expect?\n\nSteps to reproduce:\n1. \n\nMargin: ${version}\nmacOS: ${systemVersion}\nArchitecture: ${arch}\n\nPlease omit private study content.`,
	)
	return url.toString()
}

export function openLink(url: string) {
	void shell.openExternal(url).catch((error: unknown) => logFailure('open-link-failed', error))
}

export function revealLogs() {
	logEvent('reveal-logs')
	shell.showItemInFolder(join(app.getPath('logs'), 'main.log'))
}
