import { expect, it } from 'vitest'
import { documentVersion, migrateStudy, UnsupportedStudyVersion } from './migrations'
import { migrateVersioned } from './versioning'

const envelope = {
	format: 'margin-study',
	id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
	title: 'Outline',
	createdAt: '2026-11-19T12:00:00.000Z',
	updatedAt: '2026-11-19T12:00:00.000Z',
	revision: 0,
}
const store = {
	'page:page': {
		typeName: 'page',
		id: 'page:page',
		name: 'Page 1',
		index: 'a1',
		meta: { schemaVersion: 1, tags: [] },
	},
}
const schema = { schemaVersion: 2, sequences: {} }
const shape = {
	typeName: 'shape',
	id: 'shape:diagram',
	parentId: 'page:page',
	x: 0,
	y: 0,
	rotation: 0,
	index: 'a1',
	isLocked: false,
	opacity: 1,
}

it.each(['geo', 'line', 'text'])(
	'requires format 3 for a new %s diagram and rejects it on a format 2 reader',
	(type) => {
		const document = {
			schema,
			store: { ...store, [shape.id]: { ...shape, type, meta: { marginDiagram: true }, props: {} } },
		}
		const study = { ...envelope, schemaVersion: documentVersion(document), document }
		expect(study.schemaVersion).toBe(3)
		expect(migrateStudy(study)).toEqual(study)
		expect(() => migrateVersioned(study, 2, new Map())).toThrow(UnsupportedStudyVersion)
		expect(() => migrateVersioned(study, 2, new Map())).toThrow(/needs a newer version of the app/)
		expect(() => migrateStudy({ ...study, schemaVersion: 2 })).toThrow(
			/requires study format version 3/,
		)
	},
)

it('leaves historical SDK text and ink studies at their original versions', () => {
	const text = { ...shape, type: 'text', meta: {}, props: {} }
	const legacy = {
		...envelope,
		schemaVersion: 1,
		document: { schema, store: { ...store, [text.id]: text } },
	}
	expect(documentVersion(legacy.document)).toBe(1)
	expect(migrateStudy(legacy)).toEqual(legacy)
	const ink = {
		...shape,
		id: 'shape:ink',
		type: 'margin-ink',
		meta: {},
		props: { kind: 'ink', size: 2, points: [{ x: 0, y: 0, z: 0.5 }] },
	}
	const inkStudy = {
		...legacy,
		schemaVersion: 2,
		document: { schema, store: { ...legacy.document.store, [ink.id]: ink } },
	}
	expect(documentVersion(inkStudy.document)).toBe(2)
	expect(migrateStudy(inkStudy)).toEqual(inkStudy)
})
