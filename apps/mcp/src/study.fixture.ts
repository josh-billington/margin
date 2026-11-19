import type { VerseRef } from '@margin/contract/bible/types'
import type { PassageProps } from '@margin/contract/study/types'

export const fixtureId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
export const newerId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
export const unreadableId = '01ARZ3NDEKTSV4RRFFQ69G5FAX'
const tagId = '01ARZ3NDEKTSV4RRFFQ69G5FAY'
const pageId = 'page:fixture'
const first: VerseRef = { book: 'AMO', chapter: 5, verse: 24 }
const second = { ...first, verse: 25 }
const earlier = { ...first, verse: 23 }
const target = { verse: first, token: 0 }

function shape({
	id,
	type,
	x,
	y,
	props,
	parentId = pageId,
}: {
	id: string
	type: string
	x: number
	y: number
	props: object
	parentId?: string
}) {
	return {
		id,
		typeName: 'shape',
		type,
		x,
		y,
		props,
		parentId,
		rotation: 0,
		index: 'a1',
		isLocked: false,
		opacity: 1,
		meta: {},
	}
}

const passage: PassageProps = {
	width: 500,
	layout: 'flow',
	showVerseNumbers: true,
	showSuppliedWordItalics: true,
	fontScale: 1,
	text: {
		edition: {
			translationId: 'kjv',
			editionName: 'PRIVATE-EDITION-LABEL',
			versificationId: 'fixture',
			corpusRevision: 'fixture',
			tokenizerVersion: 'fixture',
		},
		ranges: [{ start: first, end: second }],
		verses: [
			{
				ref: first,
				paragraphBreakBefore: false,
				tokens: [
					{
						i: 0,
						leading: '',
						runs: [{ text: 'Judgment', italic: false }],
						trailing: ',',
						spaceAfter: ' ',
					},
					{
						i: 1,
						leading: '',
						runs: [{ text: 'let', italic: true }],
						trailing: '',
						spaceAfter: ' ',
					},
					{
						i: 2,
						leading: '',
						runs: [{ text: 'it run', italic: false }],
						trailing: '.',
						spaceAfter: '',
					},
				],
			},
			{
				ref: second,
				paragraphBreakBefore: true,
				tokens: [
					{
						i: 0,
						leading: '',
						runs: [{ text: 'Sacrifices', italic: false }],
						trailing: '?',
						spaceAfter: '',
					},
				],
			},
		],
	},
	highlights: [
		{ id: '01ARZ3NDEKTSV4RRFFQ69G5FAZ', tagId, start: target, end: { verse: first, token: 1 } },
		{
			id: '01ARZ3NDEKTSV4RRFFQ69G5FB0',
			color: 'amber',
			start: { verse: first, token: 2 },
			end: { verse: second, token: 0 },
		},
	],
}

export function fixtureStudy() {
	const records = [
		{
			id: pageId,
			typeName: 'page',
			name: 'Fixture page',
			index: 'a1',
			meta: { schemaVersion: 1, tags: [{ id: tagId, name: 'Justice', color: 'sky' }] },
		},
		shape({
			id: 'shape:free',
			type: 'margin-note',
			x: 400,
			y: 290,
			props: {
				text: '',
				size: 'M',
				color: 'ink',
				font: 'plain',
				w: 180,
				h: 40,
				strokes: [{ opaque: true }],
			},
		}),
		shape({
			id: 'shape:passage-right',
			type: 'passage',
			x: 20,
			y: 0,
			parentId: 'shape:group',
			props: passage,
		}),
		shape({ id: 'shape:group', type: 'group', x: 380, y: 200, props: {} }),
		shape({
			id: 'shape:question',
			type: 'margin-note',
			x: 700,
			y: 10,
			props: {
				text: 'What does justice look like here?',
				size: 'M',
				color: 'ink',
				font: 'plain',
				w: 180,
				h: 40,
				association: { passageId: 'shape:passage-right', verse: first },
			},
		}),
		shape({
			id: 'shape:passage-left',
			type: 'passage',
			x: 20,
			y: 200,
			props: {
				...passage,
				highlights: [],
				text: {
					...passage.text,
					ranges: [{ start: earlier, end: earlier }],
					verses: [
						{
							ref: earlier,
							paragraphBreakBefore: false,
							tokens: [
								{
									i: 0,
									leading: '',
									runs: [{ text: 'Take away the noise of thy songs', italic: false }],
									trailing: '.',
									spaceAfter: '',
								},
							],
						},
					],
				},
			},
		}),
		shape({ id: 'shape:arrow', type: 'arrow', x: 420, y: 80, props: {} }),
		{
			id: 'binding:start',
			typeName: 'binding',
			type: 'arrow',
			fromId: 'shape:arrow',
			toId: 'shape:question',
			props: { terminal: 'start' },
			meta: {},
		},
		{
			id: 'binding:end',
			typeName: 'binding',
			type: 'arrow',
			fromId: 'shape:arrow',
			toId: 'shape:passage-right',
			props: { terminal: 'end' },
			meta: { schemaVersion: 1, target },
		},
	]
	return {
		format: 'margin-study',
		schemaVersion: 1,
		id: fixtureId,
		title: 'Worship and Justice',
		revision: 0,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-02T00:00:00.000Z',
		document: {
			schema: { schemaVersion: 2, sequences: {} },
			store: Object.fromEntries(records.map((record) => [record.id, record])),
		},
	}
}
