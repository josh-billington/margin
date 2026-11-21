import { expect, it } from 'vitest'
import {
	createBindingId,
	createShapeId,
	createTLStore,
	loadSnapshot,
	PageRecordType,
	parseTldrawJsonFile,
	ZERO_INDEX_KEY,
} from 'tldraw'
import { ulid } from 'ulid'
import { documentVersion, migrateStudy, UnsupportedStudyVersion } from '@shared/study/migrations'
import { migrateVersioned } from '@shared/study/versioning'
import type { InkStroke } from '@shared/study/types'
import { NoteShapeUtil } from '../shapes/note/NoteShapeUtil'
import { fitStroke } from './stroke'
import { InkBindingUtil, InkShapeUtil } from './InkShapeUtil'

const points: InkStroke = [
	{ x: 0, y: 0, z: 0.3 },
	{ x: 4, y: 3, z: 0.8 },
	{ x: 10, y: 0, z: 0.4 },
]

it('fits both ends with one similarity transform and keeps pressure', () => {
	const translated = { x: 1, y: 2 }
	const fit = fitStroke({ points, start: translated, end: { x: 1, y: 22 } })
	expect(fit.scale).toBe(2)
	expect(fit.points).toEqual([
		{ ...translated, z: 0.3 },
		{ x: -5, y: 10, z: 0.8 },
		{ x: 1, y: 22, z: 0.4 },
	])
	expect(fitStroke({ points, end: { x: 0, y: -10 } }).points).toEqual([
		points[0],
		{ x: 3, y: -4, z: 0.8 },
		{ x: 0, y: -10, z: 0.4 },
	])
	expect(fitStroke({ points: [points[0]], end: translated }).points).toEqual([
		{ ...translated, z: 0.3 },
	])
})

function inkStore() {
	return createTLStore({
		shapeUtils: [NoteShapeUtil, InkShapeUtil],
		bindingUtils: [InkBindingUtil],
	})
}

const page = PageRecordType.create({
	id: PageRecordType.createId('ink'),
	name: 'Ink',
	index: ZERO_INDEX_KEY,
	meta: { schemaVersion: 1, tags: [] },
})
const note = {
	typeName: 'shape',
	type: 'margin-note',
	id: createShapeId(),
	parentId: page.id,
	index: ZERO_INDEX_KEY,
	x: 0,
	y: 0,
	rotation: 0,
	isLocked: false,
	opacity: 1,
	meta: {},
	props: {
		text: 'Original',
		width: 220,
		w: 220,
		h: 40,
		size: 'M',
		color: 'ink',
		font: 'handwritten',
		association: { passageId: 'shape:original' },
	},
}

it('loads a legacy note without changing its text or association', () => {
	const store = inkStore()
	const schema = store.schema.serialize()
	const oldSchema = {
		...schema,
		sequences: { ...schema.sequences, 'com.tldraw.shape.margin-note': 0 },
	}
	const result = parseTldrawJsonFile({
		schema: store.schema,
		json: JSON.stringify({ tldrawFileFormatVersion: 1, schema: oldSchema, records: [page, note] }),
	})
	if (!result.ok) throw new Error('Legacy note did not migrate', { cause: result.error })
	expect(result.value.get(note.id)).toEqual({ ...note, props: { ...note.props, strokes: [] } })
})

it('round-trips ink through study and SDK loading and requires a version-aware reader', () => {
	const store = inkStore()
	const shapeType = store.schema.types.shape
	const bindingType = store.schema.types.binding
	if (!shapeType || !bindingType) throw new Error('SDK shape or binding schema missing')
	const noteId = createShapeId()
	const inkId = createShapeId()
	const bindingId = createBindingId()
	store.put([
		page,
		shapeType.create({
			id: noteId,
			type: 'margin-note',
			parentId: page.id,
			index: ZERO_INDEX_KEY,
			props: { ...NoteShapeUtil.prototype.getDefaultProps(), strokes: [points] },
		}),
		shapeType.create({
			id: inkId,
			type: 'margin-ink',
			parentId: page.id,
			index: ZERO_INDEX_KEY,
			props: { kind: 'arrow', size: 3, points },
		}),
		bindingType.create({
			id: bindingId,
			type: 'margin-ink',
			fromId: inkId,
			toId: noteId,
			props: { terminal: 'end', anchor: { kind: 'block', point: { x: 0.5, y: 1 } } },
		}),
	])
	const document = store.getStoreSnapshot('document')
	expect(documentVersion({ store: { [noteId]: document.store[noteId] } })).toBe(2)
	const now = new Date().toISOString()
	const file = {
		format: 'margin-study',
		schemaVersion: documentVersion(document),
		id: ulid(),
		title: 'Ink study',
		createdAt: now,
		updatedAt: now,
		revision: 0,
		document,
	}
	const roundTrip = migrateStudy(JSON.parse(JSON.stringify(file)))
	expect(roundTrip).toEqual(file)
	expect(() => migrateVersioned(roundTrip, 1, new Map())).toThrow(UnsupportedStudyVersion)
	const restored = inkStore()
	loadSnapshot(restored, document)
	expect(restored.get(noteId)).toEqual(store.get(noteId))
	expect(restored.get(inkId)).toEqual(store.get(inkId))
	expect(restored.get(bindingId)).toEqual(store.get(bindingId))
})
