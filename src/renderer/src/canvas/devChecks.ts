import { amosFixture } from './fixtures/passages'
import {
	createBindingId,
	createShapeId,
	createTLStore,
	defaultBindingUtils,
	defaultShapeUtils,
	getSnapshot,
	getArrowInfo,
	loadSnapshot,
} from 'tldraw'
import type { Editor } from 'tldraw'
import { ulid } from 'ulid'
import { PassageShapeUtil } from './shapes/passage/PassageShapeUtil'
import { NoteShapeUtil } from './shapes/note/NoteShapeUtil'
import { MarginArrowShapeUtil } from './bindings/MarginArrowShapeUtil'
import { derived } from './bindings/derived'
import { normalizedWordCenter, targetFromElement } from './bindings/words'
import { insertPassage } from './tools/commands'
import { replaceRange } from './highlights/ranges'

const settle = () =>
	new Promise<void>((resolve) =>
		requestAnimationFrame(() =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		),
	)
function check(value: unknown, message: string): asserts value {
	if (!value) throw new Error(`M0: ${message}`)
}
let running = false
/** Empty-study-only integration check; leaves its fixture document available for inspection. */
export async function runM0Checks(editor: Editor) {
	check(!running, 'checks already running')
	check(editor.getCurrentPageShapeIds().size === 0, 'run in an empty study')
	running = true
	try {
		const id = insertPassage(editor, amosFixture)
		await document.fonts.ready
		await settle()
		const root = () =>
			editor.getContainer().querySelector<HTMLElement>(`[data-shape-id="${id}"] .passage-block`)
		const element = root()?.querySelector<HTMLElement>('[data-token-index="8"]')
		check(element, 'word DOM mounted')
		const target = targetFromElement(element)
		const noteId = createShapeId(),
			arrowId = createShapeId(),
			bindingId = createBindingId(),
			tagId = ulid()
		editor.createShape({
			id: noteId,
			type: 'margin-note',
			x: -200,
			y: 80,
			props: { text: 'A word stays with its meaning.' },
		})
		editor.createShape({
			id: arrowId,
			type: 'arrow',
			x: -100,
			y: 100,
			props: { start: { x: 0, y: 0 }, end: { x: 260, y: 60 } },
		})
		let passage = editor.getShape(id)
		check(passage?.type === 'passage', 'passage exists')
		const initialPassage = passage
		const previousMeta = JSON.stringify(editor.getCurrentPage().meta)
		editor.markHistoryStoppingPoint('M0 annotate')
		editor.run(() => {
			editor.updatePage({
				id: editor.getCurrentPageId(),
				meta: { schemaVersion: 1, tags: [{ id: tagId, name: 'Place', color: 'sky' }] },
			})
			editor.updateShape({
				id,
				type: 'passage',
				props: {
					highlights: replaceRange(initialPassage.props.text, [], target, target, { tagId }),
				},
			})
			editor.createBinding({
				id: bindingId,
				type: 'arrow',
				fromId: arrowId,
				toId: id,
				props: {
					terminal: 'end',
					normalizedAnchor: normalizedWordCenter(editor, initialPassage, element),
					isPrecise: true,
					isExact: true,
					snap: 'none',
				},
				meta: { schemaVersion: 1, target },
			})
		})
		await settle()
		const assertAnchor = () => {
			const current = editor.getShape(id),
				binding = editor.getBinding(bindingId)
			check(current?.type === 'passage' && binding, 'binding survives')
			const word = root()?.querySelector(
				`[data-verse-ref="${target.verse.book}.${target.verse.chapter}.${target.verse.verse}"][data-token-index="${target.token}"]`,
			)
			check(word, 'target DOM returned')
			check(
				JSON.stringify(binding.meta) === JSON.stringify({ schemaVersion: 1, target }),
				'identity unchanged',
			)
			const arrow = editor.getShape(arrowId)
			check(arrow?.type === 'arrow', 'arrow survives')
			const info = getArrowInfo(editor, arrow)
			check(info, 'SDK resolves arrow geometry')
			const terminal = editor.getShapePageTransform(arrow).applyToPoint(info.end.point)
			const rect = word.getBoundingClientRect()
			const a = editor.screenToPage({ x: rect.left, y: rect.top }),
				b = editor.screenToPage({ x: rect.right, y: rect.bottom })
			const gap = Math.max(a.y - terminal.y, terminal.y - b.y)
			check(
				terminal.x >= a.x - 0.5 && terminal.x <= b.x + 0.5 && gap > 3 && gap < 7,
				`rendered arrow terminal sits just outside its word (gap ${gap.toFixed(2)})`,
			)
		}
		assertAnchor()
		editor.undo()
		await settle()
		check(!editor.getBinding(bindingId), 'annotation undo removes binding')
		check(
			JSON.stringify(editor.getCurrentPage().meta) === previousMeta,
			'annotation undo restores page tags',
		)
		editor.redo()
		await settle()
		assertAnchor()
		const initialWordY = element.getBoundingClientRect().y
		editor.clearHistory()
		await settle()
		let userChanges = 0
		const unlisten = editor.store.listen(() => userChanges++, { scope: 'document', source: 'user' })
		try {
			derived(editor, () => editor.updateShape({ id, type: 'passage', props: { h: 1 } }))
			await settle()
			check(!editor.getCanUndo(), 'derived geometry must not enter undo history')
			check(userChanges === 0, 'derived geometry must not trigger document/user autosave')
		} finally {
			unlisten()
		}
		for (const props of [
			{ width: 300 },
			{ layout: 'verse-per-line' as const },
			{ fontScale: 1.3 },
			{ showSuppliedWordItalics: false },
			{ highlights: [] },
		]) {
			editor.markHistoryStoppingPoint('M0 layout')
			editor.updateShape({ id, type: 'passage', props })
			await settle()
			assertAnchor()
			if ('width' in props)
				check(
					element.getBoundingClientRect().y !== initialWordY,
					'resize actually moves target to a different line',
				)
			editor.undo()
			await settle()
			assertAnchor()
			editor.redo()
			await settle()
			assertAnchor()
		}
		editor.selectNone()
		const camera = editor.getCamera()
		editor.setCamera({ ...camera, x: -100000, y: -100000 })
		await settle()
		check(editor.getCulledShapes().has(id), 'passage is actually culled offscreen')
		passage = editor.getShape(id)
		check(passage?.type === 'passage', 'culled record retained')
		const cachedAnchor = JSON.stringify(editor.getBinding(bindingId)?.props)
		editor.markHistoryStoppingPoint('M0 offscreen move and resize')
		editor.updateShape({
			id,
			type: 'passage',
			x: passage.x + 70,
			y: passage.y + 30,
			props: { width: 420 },
		})
		await settle()
		check(
			JSON.stringify(editor.getBinding(bindingId)?.props) === cachedAnchor,
			'hidden DOM keeps last geometry',
		)
		editor.setCamera(camera)
		await settle()
		assertAnchor()
		editor.undo()
		await settle()
		assertAnchor()
		editor.redo()
		await settle()
		assertAnchor()
		// Restore a visible highlight for manual review before round-tripping.
		passage = editor.getShape(id)
		check(passage?.type === 'passage', 'passage remains')
		editor.markHistoryStoppingPoint('M0 restore highlight')
		editor.updateShape({
			id,
			type: 'passage',
			props: { highlights: replaceRange(passage.props.text, [], target, target, { tagId }) },
		})
		await settle()
		const snapshot = getSnapshot(editor.store)
		const restored = createTLStore({
			shapeUtils: [
				...defaultShapeUtils.filter((util) => util.type !== 'arrow'),
				PassageShapeUtil,
				NoteShapeUtil,
				MarginArrowShapeUtil,
			],
			bindingUtils: defaultBindingUtils,
		})
		loadSnapshot(restored, JSON.parse(JSON.stringify(snapshot)))
		check(
			JSON.stringify(restored.get(id)) === JSON.stringify(editor.store.get(id)),
			'snapshot preserves full passage and highlights',
		)
		check(
			JSON.stringify(restored.get(bindingId)) === JSON.stringify(editor.store.get(bindingId)),
			'snapshot preserves word binding',
		)
		return 'PASS: word-edge terminals after reflow/options/highlight weight, cull/move/remount, undo/redo; zero derived undo/user events; SDK snapshot round-trip.'
	} finally {
		running = false
	}
}

declare global {
	interface Window {
		/** Dev-only console helpers (no UI): marginCanvasDev.insertFixture('amos' | 'psalm'). */
		marginCanvasDev?: {
			editor: Editor
			runM0Checks: () => Promise<string>
			insertFixture: (name: 'amos' | 'psalm') => void
		}
	}
}
