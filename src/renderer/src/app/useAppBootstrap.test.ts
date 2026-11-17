// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useAppBootstrap } from './useAppBootstrap'
import { useStudySession } from '../study/state'
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('./commands', () => ({ runCommand: vi.fn() }))
vi.mock('../study/session', async () => ({
	useStudySession: (await import('../study/state')).useStudySession,
	initializeStudies: vi.fn(),
	handleLibraryEvent: vi.fn(),
	flushBeforeClose: vi.fn(),
}))
it('reports a rejected last-opened preference write without an unhandled rejection', async () => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	const set = vi.fn().mockRejectedValue(new Error('Disconnected'))
	window.margin = {
		prefs: { get: vi.fn().mockResolvedValue({ ok: true, data: {} }), set },
		events: { onLibrary: () => () => {}, onFlush: () => () => {}, onCommand: () => () => {} },
	} as unknown as typeof window.margin
	const root = createRoot(document.createElement('div'))
	function Bootstrap() {
		useAppBootstrap()
		return null
	}
	try {
		await act(() => root.render(createElement(Bootstrap)))
		await act(async () => useStudySession.setState({ currentId: 'study-b' }))
		expect(set).toHaveBeenCalledWith({ lastOpenedStudyId: 'study-b' })
		expect(toast.error).toHaveBeenCalledWith("Margin couldn't save your settings. Try again.")
	} finally {
		await act(() => root.unmount())
		vi.unstubAllGlobals()
	}
})
