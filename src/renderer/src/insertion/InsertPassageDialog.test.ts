import type * as ReactModule from 'react'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { Editor } from 'tldraw'
import { InsertPassageDialog } from './InsertPassageDialog'
import { insertPassage } from '../canvas/tools/commands'

const hooks = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }))
vi.mock('react', async (original) => ({
	...(await original<typeof ReactModule>()),
	useState: (initial: unknown) => [initial, vi.fn()],
	useRef: (initial: unknown) => ({ current: initial }),
	useEffect: (effect: () => void | (() => void)) => {
		const cleanup = effect()
		if (cleanup) hooks.cleanups.push(cleanup)
	},
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('./usePreview', () => ({
	usePreview: () => ({
		status: 'resolved',
		preview: { translation: 'kjv', ranges: [], label: 'Amos 1:3' },
	}),
}))
vi.mock('../canvas/tools/commands', () => ({ insertPassage: vi.fn() }))
type NodeProps = {
	children?: unknown
	onClick: () => void
	onSubmit: (event: { preventDefault: () => void }) => void
}
function nodes(node: unknown): ReactElement<NodeProps>[] {
	if (!node || typeof node !== 'object' || !('props' in node)) return []
	const element = node as ReactElement<NodeProps>
	return [element, ...[element.props.children].flat(Infinity).flatMap(nodes)]
}
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => {
		resolve = done
	})
	return { promise, resolve }
}
async function settle() {
	for (let i = 0; i < 10; i++) await Promise.resolve()
}
beforeEach(() => {
	vi.clearAllMocks()
	hooks.cleanups = []
})
afterEach(() => {
	for (const cleanup of hooks.cleanups) cleanup()
	vi.unstubAllGlobals()
})
function render() {
	const close = vi.fn()
	const tree = InsertPassageDialog({
		open: true,
		onOpenChange: close,
		initialQuery: 'Amos 1:3',
		editor: {} as Editor,
		translation: 'kjv',
		onTranslationChange: vi.fn(),
	})
	const form = nodes(tree).find((node) => node.type === 'form')!
	return { tree, close, submit: () => form.props.onSubmit({ preventDefault: vi.fn() }) }
}
it.each(['Cancel', 'dismiss', 'unmount'])('discards pending insertion after %s', async (action) => {
	const response = deferred<unknown>()
	vi.stubGlobal('window', { margin: { bible: { getPassage: () => response.promise } } })
	const { tree, close, submit } = render()
	submit()
	if (action === 'Cancel')
		nodes(tree)
			.find((node) => node.type === 'button' && node.props.children === 'Cancel')!
			.props.onClick()
	else if (action === 'dismiss') tree.props.onOpenChange(false)
	else for (const cleanup of hooks.cleanups) cleanup()
	response.resolve({ ok: true, data: 'delayed passage' })
	await settle()
	expect(insertPassage).not.toHaveBeenCalled()
	expect(close).toHaveBeenCalledTimes(action === 'unmount' ? 0 : 1)
})

it('reports a rejected insertion request and allows another attempt', async () => {
	const getPassage = vi
		.fn()
		.mockRejectedValueOnce(new Error('Transport failure'))
		.mockResolvedValueOnce({ ok: true, data: 'passage' })
	vi.stubGlobal('window', { margin: { bible: { getPassage } } })
	const { submit } = render()
	submit()
	await settle()
	expect(toast.error).toHaveBeenCalledWith("Margin couldn't load the verses. Try again.")
	submit()
	await settle()
	expect(insertPassage).toHaveBeenCalledTimes(1)
})
