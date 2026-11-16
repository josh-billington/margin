// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
afterEach(() => {
	vi.unstubAllGlobals()
	vi.clearAllMocks()
})
it('retries preferences on a later mount after a rejected load', async () => {
	vi.resetModules()
	const { usePrefs } = await import('./usePrefs')
	const get = vi
		.fn()
		.mockRejectedValueOnce(new Error('Disconnected'))
		.mockResolvedValueOnce({ ok: true, data: { defaultNoteFont: 'plain' } })
	vi.stubGlobal('window', { margin: { prefs: { get } } })
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	const container = document.createElement('div')
	const root = createRoot(container)
	function Preferences() {
		return usePrefs().prefs?.defaultNoteFont ?? 'Loading'
	}
	try {
		await act(async () => root.render(createElement(Preferences, { key: 'first' })))
		expect(toast.error).toHaveBeenCalledWith("Margin couldn't load your settings. Try again.")
		await act(async () => root.render(createElement(Preferences, { key: 'retry' })))
		expect(get).toHaveBeenCalledTimes(2)
		expect(container.textContent).toBe('plain')
	} finally {
		await act(() => root.unmount())
	}
})
it('reports a rejected preference write without rejecting the action', async () => {
	const { updatePrefs } = await import('./usePrefs')
	vi.stubGlobal('window', {
		margin: { prefs: { set: vi.fn().mockRejectedValue(new Error('Disconnected')) } },
	})
	await expect(updatePrefs({ defaultNoteFont: 'plain' })).resolves.toBe(false)
	expect(toast.error).toHaveBeenCalledWith("Margin couldn't save your settings. Try again.")
})
it('reports a rejected canvas preference load and permits another load', async () => {
	const { loadPreferences, usePreferences } = await import('./preferences')
	const get = vi
		.fn()
		.mockRejectedValueOnce(new Error('Disconnected'))
		.mockResolvedValueOnce({ ok: true, data: { defaultNoteFont: 'plain' } })
	vi.stubGlobal('window', { margin: { prefs: { get } } })
	await loadPreferences()
	expect(toast.error).toHaveBeenCalledWith("Margin couldn't load your settings. Try again.")
	await loadPreferences()
	expect(usePreferences.getState().defaultNoteFont).toBe('plain')
})
