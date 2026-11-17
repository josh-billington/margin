import { beforeEach, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
	app: { getVersion: () => '0.9.0-beta.1' },
	dialog: { showMessageBox: vi.fn() },
	net: { fetch: vi.fn() },
	shell: { openExternal: vi.fn() },
}))
vi.mock('electron', () => electron)
import { checkForUpdates } from './updates'

const url = 'https://github.com/josh-billington/margin/releases/tag/v0.9.0-beta.10'
beforeEach(() => {
	vi.resetAllMocks()
	electron.dialog.showMessageBox.mockResolvedValue({ response: 1 })
	electron.shell.openExternal.mockResolvedValue(undefined)
	electron.net.fetch.mockResolvedValue({
		ok: true,
		json: async () => [{ tag_name: 'v0.9.0-beta.10', html_url: url, draft: false }],
	})
})

it('makes no request on import; an explicit check uses a timeout and no personal information', async () => {
	expect(electron.net.fetch).not.toHaveBeenCalled()
	await checkForUpdates()
	expect(electron.net.fetch).toHaveBeenCalledWith(
		'https://api.github.com/repos/josh-billington/margin/releases?per_page=20',
		expect.objectContaining({
			headers: { 'User-Agent': 'Margin-update-check', Accept: 'application/vnd.github+json' },
			signal: expect.any(AbortSignal),
			credentials: 'omit',
			redirect: 'error',
		}),
	)
	expect(electron.dialog.showMessageBox).toHaveBeenCalledWith(
		expect.objectContaining({
			message: 'Margin 0.9.0-beta.10 is available',
			buttons: ['Download', 'Later'],
		}),
	)
	expect(electron.shell.openExternal).not.toHaveBeenCalled()
})

it('opens the release page only after Download', async () => {
	electron.dialog.showMessageBox.mockResolvedValue({ response: 0 })
	await checkForUpdates()
	expect(electron.shell.openExternal).toHaveBeenCalledWith(url)
})

it('reports the current version as up to date', async () => {
	electron.net.fetch.mockResolvedValue({
		ok: true,
		json: async () => [{ tag_name: 'v0.9.0-beta.1', html_url: url, draft: false }],
	})
	await checkForUpdates()
	expect(electron.dialog.showMessageBox).toHaveBeenCalledWith(
		expect.objectContaining({ message: 'Margin is up to date' }),
	)
})

it.each(['network', 'timeout', 'http', 'json', 'empty', 'external'])(
	'calmly handles %s failures',
	async (failure) => {
		if (failure === 'network' || failure === 'timeout')
			electron.net.fetch.mockRejectedValue(new Error(failure))
		if (failure === 'http') electron.net.fetch.mockResolvedValue({ ok: false })
		if (failure === 'json')
			electron.net.fetch.mockResolvedValue({ ok: true, json: async () => null })
		if (failure === 'empty')
			electron.net.fetch.mockResolvedValue({ ok: true, json: async () => [] })
		if (failure === 'external') {
			electron.dialog.showMessageBox.mockResolvedValue({ response: 0 })
			electron.shell.openExternal.mockRejectedValue(new Error('Unavailable'))
		}
		await expect(checkForUpdates()).resolves.toBeUndefined()
		expect(electron.dialog.showMessageBox).toHaveBeenLastCalledWith(
			expect.objectContaining({ message: 'Margin couldn’t check for updates' }),
		)
	},
)

it('never rejects even if the error dialog fails', async () => {
	electron.net.fetch.mockRejectedValue(new Error('Offline'))
	electron.dialog.showMessageBox.mockRejectedValue(new Error('No display'))
	await expect(checkForUpdates()).resolves.toBeUndefined()
})

it('coalesces repeated clicks until the check finishes', async () => {
	let complete: (() => void) | undefined
	electron.net.fetch.mockImplementation(
		() =>
			new Promise((resolve) => {
				complete = () => resolve({ ok: false })
			}),
	)
	const pending = checkForUpdates()
	await checkForUpdates()
	expect(electron.net.fetch).toHaveBeenCalledTimes(1)
	complete?.()
	await pending
	electron.net.fetch.mockResolvedValue({ ok: false })
	await checkForUpdates()
})
