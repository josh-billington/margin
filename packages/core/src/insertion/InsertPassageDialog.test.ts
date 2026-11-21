import type * as ReactModule from 'react'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { Editor } from 'tldraw'
import type { BibleSearchHit } from '@shared/bible/search'
import { InsertPassageDialog } from './InsertPassageDialog'
import type { useBibleSearch } from './useBibleSearch'
import { insertPassages } from '../canvas/tools/commands'

const hooks = vi.hoisted(() => ({
	cleanups: [] as (() => void)[],
	selected: new Set([0]),
	setState: vi.fn(),
	search: vi.fn<() => ReturnType<typeof useBibleSearch>>(() => ({
		key: '',
		state: { kind: 'idle' },
		loadMore: vi.fn(),
	})),
}))
vi.mock('react', async (original) => ({
	...(await original<typeof ReactModule>()),
	useState: (initial: unknown) => [
		initial instanceof Set ? hooks.selected : initial,
		hooks.setState,
	],
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
vi.mock('./useBibleSearch', () => ({ useBibleSearch: hooks.search }))
vi.mock('../canvas/tools/commands', () => ({ insertPassages: vi.fn() }))
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
	hooks.selected = new Set([0])
})
afterEach(() => {
	for (const cleanup of hooks.cleanups) cleanup()
	vi.unstubAllGlobals()
})
function render({ query = 'Amos 1:3', existing = 0, limit = 4000 } = {}) {
	const close = vi.fn()
	const tree = InsertPassageDialog({
		open: true,
		onOpenChange: close,
		initialQuery: query,
		editor: {
			options: { maxShapesPerPage: limit },
			getCurrentPageShapeIds: () => ({ size: existing }),
		} as Editor,
		translation: 'kjv',
		onTranslationChange: vi.fn(),
	})
	const form = nodes(tree).find((node) => node.type === 'form')!
	return { tree, close, submit: () => form.props.onSubmit({ preventDefault: vi.fn() }) }
}

function searchResults(verses: number[]) {
	const hits: BibleSearchHit[] = verses.map((verse) => ({
		ref: { book: 'GEN', chapter: 1, verse },
		translationId: 'kjv',
		text: 'the',
		matches: [],
	}))
	hooks.selected = new Set(hits.map((_, index) => index))
	hooks.search.mockReturnValueOnce({
		key: 'the',
		state: {
			kind: 'ready',
			list: {
				key: 'the',
				hits,
				counts: { total: hits.length, books: [] },
				next: null,
				more: 'idle',
			},
		},
		loadMore: vi.fn(),
	})
}

it('rejects more runs than the canvas can hold without fetching or closing', () => {
	searchResults([1, 2, 4])
	const getPassage = vi.fn()
	vi.stubGlobal('window', { margin: { bible: { getPassage } } })
	const { submit, close } = render({ query: 'the', existing: 3999 })
	submit()
	expect(getPassage).not.toHaveBeenCalled()
	expect(close).not.toHaveBeenCalled()
	expect(hooks.setState).toHaveBeenCalledWith(expect.stringContaining('Select fewer verses'))
})

it('fits consecutive verses together and fetches only eight blocks at a time', async () => {
	searchResults([1, 2, 4, 6, 8, 10, 12, 14, 16, 18])
	const firstBatch = deferred<{ ok: true; data: string }>()
	const getPassage = vi.fn(() => firstBatch.promise)
	vi.stubGlobal('window', { margin: { bible: { getPassage } } })
	const { submit, close } = render({ query: 'the', existing: 3991 })
	submit()
	expect(getPassage).toHaveBeenCalledTimes(8)
	expect(getPassage).toHaveBeenNthCalledWith(1, {
		translationId: 'kjv',
		ranges: [
			{ start: { book: 'GEN', chapter: 1, verse: 1 }, end: { book: 'GEN', chapter: 1, verse: 2 } },
		],
	})
	firstBatch.resolve({ ok: true, data: 'passage' })
	await settle()
	expect(getPassage).toHaveBeenCalledTimes(9)
	expect(insertPassages).toHaveBeenCalledWith(expect.anything(), Array(9).fill('passage'))
	expect(close).toHaveBeenCalledWith(false)
})
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
	expect(insertPassages).not.toHaveBeenCalled()
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
	expect(toast.error).toHaveBeenCalledWith('Margin couldn’t load the verses. Try again.')
	submit()
	await settle()
	expect(insertPassages).toHaveBeenCalledTimes(1)
})
