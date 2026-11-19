import { books } from '@margin/contract/bible/books'
import { translationNames } from '@margin/contract/bible/translationNames'
import type { PassageRange, Token, Verse, VerseRef } from '@margin/contract/bible/types'
import type { WordTarget } from '@margin/contract/study/types'
import type {
	Attachment,
	Endpoint,
	Outline,
	OutlineHighlight,
	OutlineVerse,
	Search,
	StudyList,
} from './schema'
import type { Study } from './study'

type Passage = Study['passages'][number]
type Binding = Study['bindings'][number]
type Point = Pick<Study['positions'][number], 'x' | 'y'>

const bookName = (ref: VerseRef) => books.find((book) => book.id === ref.book)?.name ?? ref.book
const verseNumber = (ref: VerseRef) => `${ref.chapter}:${ref.verse}`
const verseReference = (ref: VerseRef) => `${bookName(ref)} ${verseNumber(ref)}`
const sameVerse = (first: VerseRef, second: VerseRef) =>
	first.book === second.book && first.chapter === second.chapter && first.verse === second.verse

function rangeReference({ start, end }: PassageRange) {
	if (sameVerse(start, end)) return verseReference(start)
	const tail = start.chapter === end.chapter ? end.verse : verseNumber(end)
	return `${verseReference(start)}–${tail}`
}

export const passageReference = ({ props }: Passage) =>
	props.text.ranges.map(rangeReference).join(', ')

const translation = ({ props }: Passage) => translationNames[props.text.edition.translationId].long

function canvasPositions(study: Study) {
	const positions = new Map(study.positions.map((shape) => [shape.id, shape]))
	return new Map(
		study.positions.map(({ id, x, y, parentId }) => {
			const visited = new Set([id])
			let parent = positions.get(parentId)
			while (parent && !visited.has(parent.id)) {
				visited.add(parent.id)
				const cos = Math.cos(parent.rotation)
				const sin = Math.sin(parent.rotation)
				const nextX = parent.x + x * cos - y * sin
				y = parent.y + x * sin + y * cos
				x = nextX
				parent = positions.get(parent.parentId)
			}
			return [id, { x, y }]
		}),
	)
}

function inReadingOrder(study: Study) {
	const positions = canvasPositions(study)
	const point = (id: string): Point => positions.get(id) ?? { x: 0, y: 0 }
	const compare = (first: string, second: string) => {
		const aPoint = point(first)
		const bPoint = point(second)
		return aPoint.y - bPoint.y || aPoint.x - bPoint.x || first.localeCompare(second)
	}
	return { point, compare }
}

const tokenText = (token: Token) =>
	token.leading + token.runs.map((run) => run.text).join('') + token.trailing

function outlineVerse({
	verse,
	includeItalics,
}: {
	verse: Verse
	includeItalics: boolean
}): OutlineVerse {
	let text = ''
	const spans: NonNullable<OutlineVerse['italicSpans']> = []
	for (const token of verse.tokens) {
		text += token.leading
		for (const run of token.runs) {
			const start = text.length
			text += run.text
			if (includeItalics && run.italic && text.length > start) {
				const previous = spans.at(-1)
				if (previous?.end === start) previous.end = text.length
				else spans.push({ start, end: text.length })
			}
		}
		text += token.trailing + token.spaceAfter
	}
	text = text.trimEnd()
	const italicSpans = spans
		.filter(({ start }) => start < text.length)
		.map(({ start, end }) => ({ start, end: Math.min(end, text.length) }))
	return {
		reference: verseReference(verse.ref),
		number: verse.ref.verse,
		text,
		paragraphBreakBefore: verse.paragraphBreakBefore,
		...(includeItalics ? { italicSpans } : {}),
	}
}

function passageHighlights({ passage, tags }: { passage: Passage; tags: Study['tags'] }) {
	const words = passage.props.text.verses.flatMap(({ ref, tokens }) =>
		tokens.map((token) => ({ ref, token })),
	)
	const wordIndex = (target: WordTarget) =>
		words.findIndex(({ ref, token }) => sameVerse(ref, target.verse) && token.i === target.token)
	return passage.props.highlights.flatMap<OutlineHighlight>((highlight) => {
		const start = wordIndex(highlight.start)
		const end = wordIndex(highlight.end)
		const tag = tags.find(({ id }) => id === highlight.tagId)
		const style: OutlineHighlight['style'] | undefined = tag
			? { kind: 'tag', tag }
			: highlight.color && { kind: 'color', color: highlight.color }
		if (start < 0 || end < start || !style) return []
		const selected = words.slice(start, end + 1)
		const quote = selected
			.map(({ ref, token }, index) => {
				const next = selected[index + 1]
				return tokenText(token) + (next ? (sameVerse(ref, next.ref) ? token.spaceAfter : ' ') : '')
			})
			.join('')
		const first = highlight.start.verse
		const last = highlight.end.verse
		return [
			{
				quote,
				reference:
					first.book === last.book
						? rangeReference({ start: first, end: last })
						: `${verseReference(first)}–${verseReference(last)}`,
				style,
			},
		]
	})
}

const passageLink = (passage: Passage) => ({
	passageId: passage.id,
	reference: passageReference(passage),
})
const noteContent = ({ props }: Study['notes'][number]) => ({
	text: props.text,
	handwrittenInk: Boolean(props.strokes?.length),
})

function noteAttachment({
	note,
	passages,
	point,
}: {
	note: Study['notes'][number]
	passages: Passage[]
	point: (id: string) => Point
}): Attachment {
	const association = note.props.association
	const attached = association && passages.find(({ id }) => id === association.passageId)
	if (attached) {
		const link = passageLink(attached)
		return association.verse
			? { kind: 'verse', ...link, verse: verseReference(association.verse) }
			: { kind: 'passage', ...link }
	}
	const origin = point(note.id)
	let nearest: Passage | undefined
	let distance = Infinity
	for (const passage of passages) {
		const position = point(passage.id)
		const candidate = Math.hypot(position.x - origin.x, position.y - origin.y)
		if (candidate < distance) {
			nearest = passage
			distance = candidate
		}
	}
	return { kind: 'free', nearest: nearest ? passageLink(nearest) : null }
}

function arrowEndpoint({
	binding,
	passages,
	notes,
}: {
	binding: Binding | undefined
	passages: Map<string, Passage>
	notes: Map<string, Study['notes'][number]>
}): Endpoint {
	if (!binding) return { kind: 'unbound' }
	const passage = passages.get(binding.toId)
	if (passage) {
		const link = passageLink(passage)
		const target = binding.meta.target ?? binding.props.target
		if (!target) return { kind: 'passage', ...link }
		const verse = passage.props.text.verses.find(({ ref }) => sameVerse(ref, target.verse))
		if (!verse) return { kind: 'passage', ...link }
		const reference = verseReference(verse.ref)
		const token = verse.tokens.find(({ i: index }) => index === target.token)
		return token
			? { kind: 'word', ...link, verse: reference, quote: tokenText(token) }
			: { kind: 'verse', ...link, verse: reference }
	}
	const note = notes.get(binding.toId)
	return note
		? { kind: 'note', noteId: note.id, ...noteContent(note) }
		: { kind: 'shape', shapeId: binding.toId }
}

export const inkLabel = 'handwritten ink, not transcribed'

function describeEndpoint(endpoint: Endpoint): string {
	switch (endpoint.kind) {
		case 'word':
			return `“${endpoint.quote}” (${endpoint.verse})`
		case 'verse':
			return endpoint.verse
		case 'passage':
			return endpoint.reference
		case 'note': {
			const text = endpoint.text.trim().replace(/\s+/g, ' ')
			const ink = endpoint.handwrittenInk ? ` (${inkLabel})` : ''
			return text
				? `note “${text}”${ink}`
				: `note (${endpoint.handwrittenInk ? inkLabel : 'empty'})`
		}
		case 'shape':
			return `another canvas shape (${endpoint.shapeId})`
		case 'unbound':
			return 'an unbound point'
	}
}

export function outlineStudy({
	study,
	includeItalics,
}: {
	study: Study
	includeItalics: boolean
}): Outline {
	const { id, title, updatedAt, tags } = study
	const { point, compare } = inReadingOrder(study)
	const passages = study.passages.toSorted((first, second) => compare(first.id, second.id))
	const passagesById = new Map(passages.map((passage) => [passage.id, passage]))
	const notesById = new Map(study.notes.map((note) => [note.id, note]))
	const blocks: Outline['blocks'] = [
		...passages.map<Outline['blocks'][number]>((passage) => ({
			kind: 'passage',
			id: passage.id,
			reference: passageReference(passage),
			translation: translation(passage),
			verses: passage.props.text.verses.map((verse) => outlineVerse({ verse, includeItalics })),
			highlights: passageHighlights({ passage, tags }),
		})),
		...study.notes.map<Outline['blocks'][number]>((note) => ({
			kind: 'note',
			id: note.id,
			...noteContent(note),
			attachment: noteAttachment({ note, passages, point }),
		})),
	]
	blocks.sort((first, second) => compare(first.id, second.id))
	const bindings = new Map(
		study.bindings.map((binding) => [`${binding.props.terminal}:${binding.fromId}`, binding]),
	)
	const arrows = study.arrows.toSorted(compare).map((id) => {
		const from = arrowEndpoint({
			binding: bindings.get(`start:${id}`),
			passages: passagesById,
			notes: notesById,
		})
		const to = arrowEndpoint({
			binding: bindings.get(`end:${id}`),
			passages: passagesById,
			notes: notesById,
		})
		return {
			id,
			from,
			to,
			description: `From ${describeEndpoint(from)} to ${describeEndpoint(to)}`,
		}
	})
	return { id, title, updatedAt, blocks, arrows, tags }
}

export function summarizeStudy(study: Study): StudyList['studies'][number] {
	const { id, title, updatedAt } = study
	const { compare } = inReadingOrder(study)
	const passages = study.passages.toSorted((first, second) => compare(first.id, second.id))
	return {
		id,
		title,
		updatedAt,
		passages: passages.map((passage) => `${passageReference(passage)} (${translation(passage)})`),
		counts: {
			highlights: passages.reduce((sum, passage) => sum + passage.props.highlights.length, 0),
			notes: study.notes.length,
			arrows: study.arrows.length,
		},
	}
}

export function searchStudy({
	study,
	query,
}: {
	study: Study
	query: string
}): Search['studies'][number] | null {
	const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu')
	const matches: Search['studies'][number]['matches'] = []
	const addMatch = ({
		field,
		text,
	}: {
		field: (typeof matches)[number]['field']
		text: string
	}) => {
		const match = pattern.exec(text)
		if (!match) return false
		const start = Math.max(0, match.index - 45)
		const end = Math.min(text.length, match.index + match[0].length + 45)
		const snippet = `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
		matches.push({ field, snippet })
		return true
	}
	addMatch({ field: 'title', text: study.title })
	for (const note of study.notes) addMatch({ field: 'note', text: note.props.text })
	for (const passage of study.passages) {
		if (addMatch({ field: 'reference', text: passageReference(passage) })) continue
		const verse = passage.props.text.verses.find(({ ref }) => pattern.test(verseReference(ref)))
		if (verse) addMatch({ field: 'reference', text: verseReference(verse.ref) })
	}
	return matches.length ? { id: study.id, title: study.title, matches } : null
}
