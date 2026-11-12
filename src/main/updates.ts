import { app, dialog, net, shell } from 'electron'
import { compareVersions, latestRelease } from './versions'

let checking = false

export async function checkForUpdates() {
	if (checking) return
	checking = true
	try {
		const response = await net.fetch(
			'https://api.github.com/repos/josh-billington/margin/releases?per_page=20',
			{
				headers: { 'User-Agent': 'Margin-update-check', Accept: 'application/vnd.github+json' },
				signal: AbortSignal.timeout(8000),
				credentials: 'omit',
				redirect: 'error',
			},
		)
		if (!response.ok) throw new Error('Update request failed')
		const release = latestRelease(await response.json())
		if (!release) throw new Error('No releases found')
		if (compareVersions(release.tag_name, app.getVersion()) <= 0) {
			await dialog.showMessageBox({
				type: 'info',
				message: 'Margin is up to date',
				detail: `You’re using Margin ${app.getVersion()}.`,
			})
		} else {
			const result = await dialog.showMessageBox({
				type: 'info',
				message: `Margin ${release.tag_name.replace(/^v/, '')} is available`,
				detail:
					'Download the new version and replace Margin in Applications. Your studies stay on your Mac.',
				buttons: ['Download', 'Later'],
				defaultId: 0,
				cancelId: 1,
			})
			if (result.response === 0) await shell.openExternal(release.html_url)
		}
	} catch {
		await dialog
			.showMessageBox({
				type: 'info',
				message: 'Couldn’t check for updates',
				detail: 'Please try again later. You can keep studying offline.',
			})
			.catch(() => undefined)
	} finally {
		checking = false
	}
}
