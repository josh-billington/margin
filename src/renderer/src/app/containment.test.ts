// @vitest-environment happy-dom
import type * as TldrawModule from 'tldraw'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'
import { LookupOverlay } from '../canvas/lookup/LookupPopover'

const fault = vi.hoisted(() => ({ area: '', active: true }))
vi.mock('./useAppBootstrap', () => ({ useAppBootstrap: vi.fn() }))
vi.mock('./useGlobalShortcuts', () => ({ useGlobalShortcuts: vi.fn() }))
vi.mock('./AppProviders', () => ({
	AppProviders: ({ children }: { children: unknown }) => children,
}))
vi.mock('./TitleBar', () => ({ TitleBar: () => null }))
vi.mock('./Toolbar', () => ({ Toolbar: () => null }))
vi.mock('./Sidebar', () => ({
	Sidebar: () => {
		if (fault.area === 'sidebar' && fault.active) throw new Error('Sidebar fault')
		return 'Sidebar restored'
	},
}))
vi.mock('./DialogsHost', () => ({
	DialogsHost: () => {
		if (fault.area === 'dialogs' && fault.active) throw new Error('Dialog fault')
		return 'Dialogs restored'
	},
}))
vi.mock('../study/StudyWorkspace', () => ({ StudyWorkspace: () => 'Usable canvas' }))
vi.mock('../study/session', () => ({
	useStudySession: () => ({ sessions: {} }),
	renameStudy: vi.fn(),
	retrySave: vi.fn(),
	saveCopy: vi.fn(),
	createStudy: vi.fn(),
}))
vi.mock('tldraw', async (original) => ({
	...(await original<typeof TldrawModule>()),
	useEditor: () => ({}),
	useValue: () => {
		if (fault.area === 'lookup' && fault.active) throw new Error('Lookup fault')
		return null
	},
}))
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	vi.spyOn(console, 'error').mockImplementation(() => {})
	fault.active = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(() => root.unmount())
	container.remove()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})
it.each(['sidebar', 'dialogs'])(
	'contains a %s render failure and retries without unmounting the canvas',
	async (area) => {
		fault.area = area
		await act(() => root.render(createElement(App)))
		expect(container.textContent).toContain('Usable canvas')
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('Try again')
		fault.active = false
		await act(() => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
		expect(container.querySelector('[role="alert"]')).toBeNull()
		expect(container.textContent).toContain('Usable canvas')
		expect(container.textContent).toContain(
			area === 'sidebar' ? 'Sidebar restored' : 'Dialogs restored',
		)
	},
)
it('contains a lookup render failure without removing the surrounding canvas', async () => {
	fault.area = 'lookup'
	await act(() =>
		root.render(createElement('div', null, 'Usable canvas', createElement(LookupOverlay))),
	)
	expect(container.textContent).toContain('Usable canvas')
	expect(container.querySelector('[role="alert"]')?.textContent).toContain('Try again')
})
