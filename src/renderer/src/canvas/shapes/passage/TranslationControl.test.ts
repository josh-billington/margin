import type * as ReactModule from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { Editor } from 'tldraw'
import { TranslationControl } from './TranslationControl'
import { amosFixture } from '../../fixtures/passages'
import type { PassageShape } from '../types'
vi.mock('react', async (original) => ({
	...(await original<typeof ReactModule>()),
	useState: (initial: unknown) => [initial, vi.fn()],
	useRef: (initial: unknown) => ({ current: initial }),
}))
afterEach(() => vi.unstubAllGlobals())
type NodeProps = { children?: unknown; onClick: () => void }
function nodes(node: unknown): ReactElement<NodeProps>[] {
	if (!node || typeof node !== 'object' || !('props' in node)) return []
	const element = node as ReactElement<NodeProps>
	return [element, ...[element.props.children].flat(Infinity).flatMap(nodes)]
}
async function settle() {
	for (let i = 0; i < 10; i++) await Promise.resolve()
}
it.each(['highlight', 'word arrow', 'text', 'deleted', 'unchanged'])(
	'checks the live passage before translation completes: %s',
	async (mutation) => {
		let resolve!: (result: unknown) => void
		const response = new Promise((done) => {
			resolve = done
		})
		let shape = {
			id: 'shape:one',
			type: 'passage',
			props: { text: amosFixture, highlights: [] },
		} as unknown as PassageShape | undefined
		let bindings: { meta: unknown }[] = []
		const editor = {
			getShape: () => shape,
			getBindingsToShape: () => bindings,
			markHistoryStoppingPoint: vi.fn(),
			updateShape: vi.fn(),
		}
		vi.stubGlobal('window', {
			margin: {
				bible: {
					mapPassage: async () => ({ ok: true, data: { kind: 'mapped', ranges: [] } }),
					getPassage: () => response,
				},
			},
		})
		const tree = TranslationControl({
			editor: editor as unknown as Editor,
			shape: shape!,
			lockReason: null,
		})
		nodes(tree)
			.find((node) => node.type === 'button')!
			.props.onClick()
		await settle()
		if (mutation === 'highlight')
			shape = {
				...shape!,
				props: { ...shape!.props, highlights: [{ start: {}, end: {} }] },
			} as PassageShape
		if (mutation === 'word arrow')
			bindings = [
				{ meta: { schemaVersion: 1, target: { verse: amosFixture.verses[0]!.ref, token: 0 } } },
			]
		if (mutation === 'text')
			shape = {
				...shape!,
				props: {
					...shape!.props,
					text: { ...amosFixture, edition: { ...amosFixture.edition, translationId: 'jps1917' } },
				},
			}
		if (mutation === 'deleted') shape = undefined
		resolve({ ok: true, data: 'new translation' })
		await settle()
		expect(editor.updateShape).toHaveBeenCalledTimes(mutation === 'unchanged' ? 1 : 0)
	},
)
