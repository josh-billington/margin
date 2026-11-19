import { expect, it } from 'vitest'
import {
	createTLStore,
	createShapeId,
	createBindingId,
	PageRecordType,
	DocumentRecordType,
	TLDOCUMENT_ID,
	TLINSTANCE_ID,
	defaultShapeUtils,
	defaultBindingUtils,
	loadSnapshot,
	getSnapshot,
	ZERO_INDEX_KEY,
	ArrowShapeUtil,
} from 'tldraw'
import { ulid } from 'ulid'
import { PassageShapeUtil } from './shapes/passage/PassageShapeUtil'
import { NoteShapeUtil } from './shapes/note/NoteShapeUtil'
import { amosFixture } from './fixtures/passages'
import { words } from './highlights/ranges'

it('round-trips immutable snapshot, page tags, highlights and precise word binding through SDK migrations', () => {
	const makeStore = () =>
		createTLStore({
			shapeUtils: [...defaultShapeUtils, PassageShapeUtil, NoteShapeUtil],
			bindingUtils: defaultBindingUtils,
		})
	const store = makeStore()
	const pageId = PageRecordType.createId('snapshot-test'),
		passageId = createShapeId(),
		arrowId = createShapeId()
	const tagId = ulid(),
		target = words(amosFixture)[3]
	if (!target) throw new Error('Fixture missing word')
	const shapeType = store.schema.types.shape
	const bindingType = store.schema.types.binding
	const instanceType = store.schema.types.instance
	if (!shapeType || !bindingType || !instanceType) throw new Error('SDK schema missing records')
	store.put([
		DocumentRecordType.create({ id: TLDOCUMENT_ID }),
		instanceType.create({ id: TLINSTANCE_ID, currentPageId: pageId }),
		PageRecordType.create({
			id: pageId,
			name: 'Test',
			index: ZERO_INDEX_KEY,
			meta: { schemaVersion: 1, tags: [{ id: tagId, name: 'Place', color: 'sky' }] },
		}),
		shapeType.create({
			id: passageId,
			type: 'passage',
			index: ZERO_INDEX_KEY,
			parentId: pageId,
			props: {
				width: 720,
				h: 400,
				text: amosFixture,
				layout: 'flow',
				showVerseNumbers: true,
				showSuppliedWordItalics: true,
				fontScale: 1,
				highlights: [{ id: ulid(), tagId, start: target, end: target }],
			},
		}),
		shapeType.create({
			id: arrowId,
			type: 'arrow',
			index: ZERO_INDEX_KEY,
			parentId: pageId,
			props: ArrowShapeUtil.prototype.getDefaultProps(),
		}),
		bindingType.create({
			id: createBindingId(),
			type: 'arrow',
			fromId: arrowId,
			toId: passageId,
			props: {
				terminal: 'end',
				normalizedAnchor: { x: 0.25, y: 0.3 },
				isExact: true,
				isPrecise: true,
				snap: 'none',
			},
			meta: { schemaVersion: 1, target },
		}),
	])
	const snapshot = JSON.parse(JSON.stringify(getSnapshot(store)))
	const restored = makeStore()
	loadSnapshot(restored, snapshot)
	expect(restored.getStoreSnapshot()).toEqual(store.getStoreSnapshot())
	const passage = restored.get(passageId)
	if (passage?.typeName !== 'shape' || passage.type !== 'passage')
		throw new Error('Passage missing')
	expect(passage.props.text).toEqual(amosFixture)
	expect(passage.props.highlights[0]?.start).toEqual(target)
})
