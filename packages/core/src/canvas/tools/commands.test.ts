import { afterEach, expect, it, vi } from 'vitest'
import type { Editor } from 'tldraw'
import { installCanvasCommands } from './commands'
import { installSpacePan } from './spacePan'

vi.mock('./shortcuts', () => ({
	installShortcuts: () => () => {},
	shortcutContext: () => ({
		isComposing: false,
		editingShape: false,
		inInteractiveSurface: false,
		popoverOpen: false,
		textSelected: false,
	}),
}))
afterEach(() => vi.unstubAllGlobals())
function setup() {
	const doc = Object.assign(new EventTarget(), { body: new EventTarget() })
	vi.stubGlobal('document', doc)
	vi.stubGlobal('window', new EventTarget())
	const containers = new Map<EventTarget, string>()
	vi.stubGlobal('getComputedStyle', (container: EventTarget) => ({
		visibility: containers.get(container),
	}))
	const makeEditor = (visibility: string) => {
		const container = Object.assign(new EventTarget(), { ownerDocument: doc })
		containers.set(container, visibility)
		return {
			getContainer: () => container,
			getCurrentToolId: () => 'select',
			isIn: () => false,
			setCurrentTool: vi.fn(),
			focus: vi.fn(),
			dispatch: vi.fn(),
		}
	}
	return { doc, hidden: makeEditor('hidden'), active: makeEditor('visible') }
}
it('routes tool keys only to the visible canvas', () => {
	const { doc, hidden, active } = setup()
	const off1 = installCanvasCommands(hidden as unknown as Editor)
	const off2 = installCanvasCommands(active as unknown as Editor)
	try {
		doc.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'a' }))
		expect(hidden.setCurrentTool).not.toHaveBeenCalled()
		expect(active.setCurrentTool).toHaveBeenCalledWith('arrow')
	} finally {
		off1()
		off2()
	}
})
it('routes Space from the body only to the visible canvas', () => {
	const { doc, hidden, active } = setup()
	const off1 = installSpacePan(hidden as unknown as Editor)
	const off2 = installSpacePan(active as unknown as Editor)
	try {
		const event = Object.assign(new Event('keydown', { cancelable: true }), {
			code: 'Space',
			key: ' ',
			repeat: false,
		})
		Object.defineProperty(event, 'target', { value: doc.body })
		doc.dispatchEvent(event)
		expect(hidden.focus).not.toHaveBeenCalled()
		expect(hidden.dispatch).not.toHaveBeenCalled()
		expect(active.dispatch).toHaveBeenCalledTimes(1)
	} finally {
		off1()
		off2()
	}
})
