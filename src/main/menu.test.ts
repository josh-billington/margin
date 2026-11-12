import type { MenuItemConstructorOptions } from 'electron'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	build: vi.fn<(template: MenuItemConstructorOptions[]) => MenuItemConstructorOptions[]>(
		(template) => template,
	),
	set: vi.fn(),
	check: vi.fn(),
	open: vi.fn(),
	reveal: vi.fn(),
}))
vi.mock('electron', () => ({
	app: { name: 'Margin', isPackaged: true, getVersion: () => '0.9.0-beta.1' },
	Menu: { buildFromTemplate: mocks.build, setApplicationMenu: mocks.set },
}))
vi.mock('./updates', () => ({ checkForUpdates: mocks.check }))
vi.mock('./help', () => ({
	feedbackUrl: () => 'https://github.com/josh-billington/margin/issues/new?title=',
	openLink: mocks.open,
	revealLogs: mocks.reveal,
	WEBSITE: 'https://margin-bible.pages.dev',
}))
import { installAppMenu } from './menu'

beforeEach(() => vi.clearAllMocks())

it('places explicit updates under About and never checks while installing the menu', () => {
	installAppMenu(() => null)
	const template = mocks.build.mock.calls[0]?.[0] ?? []
	const submenu = template[0]?.submenu
	if (!Array.isArray(submenu)) throw new Error('Missing app submenu')
	expect(submenu[0]?.role).toBe('about')
	expect(submenu[1]?.label).toBe('Check for Updates…')
	expect(mocks.check).not.toHaveBeenCalled()
	const click = submenu[1]?.click
	if (!click) throw new Error('Missing update action')
	Reflect.apply(click, undefined, [])
	expect(mocks.check).toHaveBeenCalledOnce()
})

it('exposes feedback, local logs, and the website in Help', () => {
	installAppMenu(() => null)
	const template = mocks.build.mock.calls[0]?.[0] ?? []
	const submenu = template.find((item) => item.role === 'help')?.submenu
	if (!Array.isArray(submenu)) throw new Error('Missing Help submenu')
	expect(submenu.map((item) => item.label).filter(Boolean)).toEqual([
		'Send Feedback…',
		'Reveal Logs',
		'Margin Website',
	])
	expect(mocks.open).not.toHaveBeenCalled()
	const reveal = submenu.find((item) => item.label === 'Reveal Logs')?.click
	const website = submenu.find((item) => item.label === 'Margin Website')?.click
	if (!reveal || !website) throw new Error('Missing Help actions')
	Reflect.apply(reveal, undefined, [])
	Reflect.apply(website, undefined, [])
	expect(mocks.reveal).toHaveBeenCalledOnce()
	expect(mocks.open).toHaveBeenCalledWith('https://margin-bible.pages.dev')
})
