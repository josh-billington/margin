import { DOMParser } from '@xmldom/xmldom'
import type { Element, Node } from '@xmldom/xmldom'
import { bdbEntrySchema, type BdbEntry, type BdbSense, type BdbSegment } from '@shared/lexicon/bdb'
import {
	expandBdbPos,
	expandBdbStem,
	expandBdbAspect,
	expandBdbInline,
	expandBdbEmphasis,
} from './bdbAbbreviations'
import { strongIdSchema } from '@shared/lexicon/types'

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()
const isElement = (node: Node): node is Element => node.nodeType === 1
const children = (node: Node) => Array.from(node.childNodes).filter(isElement)
const text = (node: Node) => clean(node.textContent ?? '')
function xml(source: string, root: string) {
	if (/<!DOCTYPE/i.test(source)) throw new Error('Lexicon XML must not declare a DOCTYPE')
	const document = new DOMParser({
		onError: (_level, message) => {
			throw new Error(message)
		},
	}).parseFromString(source.replace(/^\uFEFF/, ''), 'application/xml')
	if (document.documentElement?.localName !== root) throw new Error(`Expected XML ${root}`)
	return document
}

const boundary = (value: string) => clean(value).replace(/^[\s.,;:—–-]+|[\s,;:—–-]+$/g, '')
function segments(node: Node, inherited: BdbSegment['kind'] = 'text'): BdbSegment[] {
	if (
		isElement(node) &&
		['sense', 'status', 'page', 'pos', 'stem', 'asp'].includes(node.localName ?? '')
	)
		return []
	if (!isElement(node)) {
		const value = boundary(expandBdbInline(node.textContent ?? ''))
		return value && /[\p{L}\p{N}]/u.test(value) ? [{ kind: inherited, text: value }] : []
	}
	const kind =
		node.localName === 'def'
			? 'def'
			: node.localName === 'w'
				? 'hebrew'
				: node.localName === 'ref'
					? 'ref'
					: undefined
	if (kind === 'def') return Array.from(node.childNodes).flatMap((child) => segments(child, 'def'))
	if (kind) {
		const value = boundary(text(node))
		return value && /[\p{L}\p{N}]/u.test(value) ? [{ kind, text: value }] : []
	}
	if (node.localName === 'em') {
		const value = boundary(expandBdbEmphasis(text(node)))
		return value && /[\p{L}\p{N}]/u.test(value) ? [{ kind: inherited, text: value }] : []
	}
	return Array.from(node.childNodes).flatMap((child) => segments(child, inherited))
}
function sense(element: Element, root = false): BdbSense {
	const inline = children(element)
	const stem = inline.find((child) => child.localName === 'stem')
	const emphasis = stem
		? inline.find((child) => child.localName === 'em' && /^(?:pass|act)\.?$/i.test(text(child)))
		: undefined
	const label = inline
		.filter((child) => child.localName === 'stem' || child.localName === 'asp')
		.map((child) =>
			child.localName === 'stem' ? expandBdbStem(text(child)) : expandBdbAspect(text(child)),
		)
		.join(' ')
	const note = emphasis && expandBdbEmphasis(text(emphasis))
	const content = Array.from(element.childNodes).filter((node) => node !== emphasis)
	if (root) {
		const headword = content.findIndex((node) => isElement(node) && node.localName === 'w')
		if (headword >= 0) {
			content.splice(headword, 1)
			const count = content[headword]
			if (count && !isElement(count)) content[headword] = count.cloneNode(false)
			if (content[headword] && !isElement(content[headword]))
				content[headword].textContent = (content[headword].textContent ?? '').replace(/^\s*\d+/, '')
		}
	}
	return {
		...(element.hasAttribute('n') ? { number: element.getAttribute('n') ?? '' } : {}),
		...(label ? { label: [label, note].filter(Boolean).join(' · ') } : {}),
		text: content.flatMap((node) => segments(node)),
		senses: inline.filter((child) => child.localName === 'sense').map((child) => sense(child)),
	}
}

export function parseBdb(source: string) {
	const entries = new Map<string, BdbEntry>()
	for (const element of xml(source, 'lexicon').getElementsByTagNameNS('*', 'entry')) {
		const id = element.getAttribute('id')
		if (!id || entries.has(id)) throw new Error(`Missing or duplicate BDB entry id: ${id}`)
		const inline = children(element)
		const headword = inline.find((child) => child.localName === 'w')
		const count = headword?.nextSibling?.textContent?.match(/^\s*(\d+)/)?.[1]
		const pos = inline.find((child) => child.localName === 'pos')
		entries.set(
			id,
			bdbEntrySchema.parse({
				id,
				lemma: headword ? text(headword) : '',
				gloss: inline
					.filter((child) => child.localName === 'def')
					.map((child) => expandBdbInline(text(child)))
					.join(', '),
				...(pos ? { pos: expandBdbPos(text(pos)) } : {}),
				...(count ? { count: Number(count) } : {}),
				senses: [sense(element, true)],
			}),
		)
	}
	return entries
}

export function mapBdb({
	entries,
	lexicalXml,
	augmentedXml,
}: {
	entries: ReadonlyMap<string, BdbEntry>
	lexicalXml: string
	augmentedXml: string
}) {
	const lexical = new Map<string, { strong: string; bdb: string; gloss: string }>()
	for (const element of xml(lexicalXml, 'index').getElementsByTagNameNS('*', 'entry')) {
		const id = element.getAttribute('id')
		if (!id || lexical.has(id)) throw new Error(`Missing or duplicate lexical index id: ${id}`)
		const inline = children(element)
		const xref = inline.find((child) => child.localName === 'xref')
		const strong = xref?.getAttribute('strong') ?? ''
		const bdb = xref?.getAttribute('bdb') ?? ''
		if (!/^\d+$/.test(strong)) continue
		lexical.set(id, {
			strong: strongIdSchema.parse(`H${strong}`),
			bdb,
			gloss: inline
				.filter((child) => child.localName === 'def')
				.map((child) => expandBdbInline(text(child)))
				.join(', '),
		})
	}
	const ordered = new Set<string>()
	const augmentedMismatches: string[] = []
	for (const word of xml(augmentedXml, 'index').getElementsByTagNameNS('*', 'w')) {
		const id = text(word)
		const link = lexical.get(id)
		if (link) {
			const augmented = word.getAttribute('aug') ?? ''
			if (
				!/^\d+[a-z]*$/.test(augmented) ||
				strongIdSchema.parse(`H${augmented.replace(/[a-z]+$/, '')}`) !== link.strong
			) {
				augmentedMismatches.push(`${augmented} → ${id} (${link.strong})`)
				continue
			}
			ordered.add(id)
		}
	}
	for (const id of lexical.keys()) ordered.add(id)
	const byStrong = new Map<string, BdbEntry[]>()
	const missingBdb = new Set<string>()
	for (const id of ordered) {
		const link = lexical.get(id)
		if (!link) continue
		const entry = entries.get(link.bdb)
		if (!entry) {
			missingBdb.add(link.strong)
			continue
		}
		const matches = byStrong.get(link.strong) ?? []
		if (!matches.some((match) => match.id === entry.id))
			matches.push({ ...entry, gloss: link.gloss || entry.gloss })
		byStrong.set(link.strong, matches)
	}
	return { byStrong, missingBdb: [...missingBdb], augmentedMismatches }
}
