import { Directory } from '@capacitor/filesystem'
import { createShapeId } from 'tldraw'
import { z } from 'zod'
import { translationIdSchema } from '@margin/contract/bible/types'
import type { PassageText } from '@margin/contract/bible/types'
import { getActiveEditor } from '../../../packages/core/src/app/editorStore'
import { useUiStore } from '../../../packages/core/src/app/uiStore'
import { insertPassage } from '../../../packages/core/src/canvas/tools/commands'
import { createFileStore } from './files'

const files = createFileStore({ directory: Directory.Library, root: 'MarginReview' })
const commandSchema = z.object({
	id: z.string(),
	operation: z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('status') }),
		z.object({ kind: z.literal('fit') }),
		z.object({ kind: z.literal('add'), reference: z.string() }),
		z.object({ kind: z.literal('lookup') }),
		z.object({ kind: z.literal('note'), text: z.string() }),
		z.object({ kind: z.literal('edit'), text: z.string() }),
		z.object({ kind: z.literal('translation'), target: translationIdSchema }),
		z.object({ kind: z.literal('performance') }),
		z.object({ kind: z.literal('search'), query: z.string() }),
		z.object({ kind: z.literal('close') }),
	]),
})

const textOf = (text: PassageText) =>
	text.verses.map((verse) => ({
		ref: verse.ref,
		text: verse.tokens
			.map(
				(token) =>
					token.leading +
					token.runs.map((run) => run.text).join('') +
					token.trailing +
					token.spaceAfter,
			)
			.join('')
			.trim(),
	}))

async function passage({ reference }: { reference: string }) {
	const resolved = await window.margin.bible.resolveReference({ reference, translationId: 'kjv' })
	if (!resolved.ok) throw new Error(resolved.error.message)
	if (resolved.data.kind !== 'resolved') throw new Error(resolved.data.message)
	const result = await window.margin.bible.getPassage({
		translationId: 'kjv',
		ranges: resolved.data.ranges,
	})
	if (!result.ok) throw new Error(result.error.message)
	return result.data
}

function status() {
	const editor = getActiveEditor()
	const title = document.querySelector('.title-bar')
	return {
		canvas: !!document.querySelector('.tl-canvas'),
		appearance: document.documentElement.dataset.appearance,
		viewport: { width: innerWidth, height: innerHeight },
		title: title
			? { top: title.getBoundingClientRect().top, paddingTop: getComputedStyle(title).paddingTop }
			: null,
		shapes: editor?.getCurrentPageShapes().map((shape) => ({
			id: shape.id,
			type: shape.type,
			text:
				shape.type === 'passage'
					? textOf(shape.props.text)
					: shape.type === 'margin-note'
						? shape.props.text
						: null,
		})),
	}
}

async function execute(operation: z.infer<typeof commandSchema>['operation']) {
	const editor = getActiveEditor()
	if (!editor) throw new Error('Editor is not ready')
	switch (operation.kind) {
		case 'fit':
			editor.zoomToFit({ animation: { duration: 0 } })
			return status()
		case 'status':
			return status()
		case 'add': {
			const text = await passage({ reference: operation.reference })
			insertPassage(editor, text)
			return { verses: textOf(text) }
		}
		case 'lookup': {
			const text = await passage({ reference: 'Genesis 1:1' })
			const verse = text.verses[0]
			const token = verse?.tokens.find((word) =>
				word.runs.some((run) => run.text.toLowerCase() === 'created'),
			)
			if (!verse || !token) throw new Error('Created is missing')
			const point = { verse: verse.ref, token: token.i }
			const lookup = await window.margin.lexicon.lookupSelection({ text, start: point, end: point })
			if (!lookup.ok) throw new Error(lookup.error.message)
			const entry = await window.margin.lexicon.getEntry({ id: 'H1254' })
			if (!entry.ok) throw new Error(entry.error.message)
			return { lookup: lookup.data, entry: entry.data }
		}
		case 'note': {
			const id = createShapeId('p7-persistence-note')
			editor.createShape({
				id,
				type: 'margin-note',
				x: 160,
				y: 260,
				props: { text: operation.text },
			})
			editor.select(id)
			return { id, text: operation.text }
		}
		case 'edit': {
			const note = editor.getCurrentPageShapes().find((shape) => shape.type === 'margin-note')
			if (!note) throw new Error('Note is missing')
			editor.updateShape({ id: note.id, type: 'margin-note', props: { text: operation.text } })
			return { id: note.id, text: operation.text }
		}
		case 'translation': {
			const shape =
				editor.getSelectedShapes().find((shape) => shape.type === 'passage') ??
				editor.getCurrentPageShapes().find((shape) => shape.type === 'passage')
			if (!shape || shape.type !== 'passage') throw new Error('Passage is missing')
			const mapped = await window.margin.bible.mapPassage({
				from: shape.props.text.edition.translationId,
				to: operation.target,
				ranges: shape.props.text.ranges,
			})
			if (!mapped.ok) throw new Error(mapped.error.message)
			if (mapped.data.kind !== 'mapped')
				throw new Error(`Mapping requires confirmation: ${mapped.data.kind}`)
			const result = await window.margin.bible.getPassage({
				translationId: operation.target,
				ranges: mapped.data.ranges,
			})
			if (!result.ok) throw new Error(result.error.message)
			editor.updateShape({ id: shape.id, type: 'passage', props: { text: result.data } })
			return { mapping: mapped.data, verses: textOf(result.data) }
		}
		case 'performance': {
			const resolved = await window.margin.bible.resolveReference({
				reference: 'Psalm 119',
				translationId: 'kjv',
			})
			if (!resolved.ok) throw new Error(resolved.error.message)
			if (resolved.data.kind !== 'resolved') throw new Error(resolved.data.message)
			const times: number[] = []
			for (let index = 0; index < 10; index++) {
				const start = performance.now()
				const result = await window.margin.bible.getPassage({
					translationId: 'kjv',
					ranges: resolved.data.ranges,
				})
				if (!result.ok || result.data.verses.length !== 176)
					throw new Error('Psalm 119 fetch failed')
				times.push(performance.now() - start)
			}
			const sorted = [...times].sort((left, right) => left - right)
			const lower = sorted[4],
				upper = sorted[5]
			if (lower === undefined || upper === undefined) throw new Error('Missing timings')
			return { times, median: (lower + upper) / 2 }
		}
		case 'search': {
			// Times the FTS5 query ten times, then shows it in the Add verses dialog for screenshots.
			const times: number[] = []
			let total = 0
			for (let index = 0; index < 10; index++) {
				const start = performance.now()
				const result = await window.margin.bible.search({
					query: operation.query,
					translation: { kind: 'edition', id: 'kjv' },
					scope: { kind: 'all' },
				})
				if (!result.ok) throw new Error(result.error.message)
				times.push(performance.now() - start)
				total = result.data.counts?.total ?? 0
			}
			useUiStore.getState().openInsert(operation.query)
			return { total, times }
		}
		case 'close':
			useUiStore.getState().closeInsert()
			return null
		default: {
			const exhaustive: never = operation
			return exhaustive
		}
	}
}

window.addEventListener('error', (event) => console.error('[p7]', 'error', event.message))
window.addEventListener('unhandledrejection', (event) =>
	console.error('[p7]', 'rejection', String(event.reason)),
)
document.addEventListener('securitypolicyviolation', (event) =>
	console.error('[p7]', 'csp', event.violatedDirective, event.blockedURI),
)

await files.makeDir('')
let firstPaint = false
function observePaint() {
	if (firstPaint) return
	const verse = document.querySelector('[data-shape-type="passage"] [data-word]')
	if (verse && verse.getBoundingClientRect().width > 0) {
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				const result = { epoch: Date.now(), navigationMs: performance.now() }
				console.info('[p7] first-painted-verse', JSON.stringify(result))
				void files.writeAtomic({ path: 'first-paint.json', content: JSON.stringify(result) })
			}),
		)
		firstPaint = true
	} else requestAnimationFrame(observePaint)
}
requestAnimationFrame(observePaint)

let previous = ''
let busy = false
setInterval(() => {
	if (busy) return
	busy = true
	void (async () => {
		const raw = await files.read('command.json').catch(() => null)
		if (!raw) return
		const command = commandSchema.parse(JSON.parse(raw))
		if (command.id === previous) return
		previous = command.id
		try {
			const result = await execute(command.operation)
			await files.writeAtomic({
				path: `result-${command.id}.json`,
				content: JSON.stringify({ ok: true, result }),
			})
			console.info('[p7] command', command.id, JSON.stringify(result))
		} catch (error) {
			await files.writeAtomic({
				path: `result-${command.id}.json`,
				content: JSON.stringify({ ok: false, error: String(error) }),
			})
			console.error('[p7] command-failed', command.id, String(error))
		}
	})()
		.catch((error: unknown) => console.error('[p7] probe-failed', error))
		.finally(() => {
			busy = false
		})
}, 1000)
