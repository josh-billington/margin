import { describe, expect, it } from 'vitest'
import { ulid } from 'ulid'
import { amosFixture } from '../fixtures/passages'
import { orderTagMatches, retagHighlights, words, wordIndex } from '../highlights/ranges'
import { validateHighlights } from '@shared/study/annotationValidation'
import { countHighlightRanges, mergeImportedTags } from '@shared/study/tags'
import type { Highlight, Tag } from '@shared/study/types'
import { describeImpact, planDeletion } from './deletion'
import { pairDuplicates, remapAssociation, remapHighlightIds } from './duplicate'
import { prepareImport } from './importContent'
import { isCanvasShortcutKey, shortcutsSuppressed } from '../shortcutContext'

const all = words(amosFixture)
const w = (i: number) => {
	const word = all[i - 1]
	if (!word) throw new Error('fixture')
	return word
}
const a = ulid(),
	b = ulid()
const range = (lo: number, hi: number, tagId = a): Highlight => ({
	id: ulid(),
	tagId,
	start: w(lo),
	end: w(hi),
})
const tag = (name: string, color: Tag['color'] = 'sky', id = ulid()): Tag => ({ id, name, color })

describe('tag import', () => {
	it('reuses only name+color matches and never replaces on ID collision', () => {
		const place = tag('Place')
		const collide = tag('Person', 'violet', place.id)
		const result = mergeImportedTags([place], [collide, tag('place'), tag('Place', 'rose')])
		expect(result.tags).toHaveLength(3)
		expect(result.tags[0]).toEqual(place)
		expect(result.idMap[collide.id]).not.toBe(place.id)
		expect(result.added.map((t) => t.name)).toEqual(['Person', 'Place'])
		expect(result.added[1]?.color).toBe('rose')
	})
	it('prepares pasted passages with fresh highlight IDs and remapped tags', () => {
		const source = tag('Place')
		const destination = tag('Place', 'sky')
		const h = range(1, 2, source.id)
		const { shapes, added } = prepareImport(
			[
				{ type: 'passage', props: { highlights: [h] } },
				{ type: 'margin-note', props: {} },
			],
			[source],
			[destination],
		)
		const [pasted] = shapes
		expect(added).toEqual([])
		expect(pasted?.props.highlights?.[0]?.tagId).toBe(destination.id)
		expect(pasted?.props.highlights?.[0]?.id).not.toBe(h.id)
	})
	it('names tags missing from the payload rather than dropping highlights', () => {
		const h = range(1, 2, b)
		const result = prepareImport([{ type: 'passage', props: { highlights: [h] } }], [], [])
		expect(result.added[0]).toMatchObject({ id: b, name: 'Imported tag' })
	})
	it('counts ranges per tag', () => {
		expect(countHighlightRanges([[range(1, 2), range(4, 5, b)], [range(1, 1)]])).toEqual({
			[a]: 2,
			[b]: 1,
		})
	})
})

describe('duplicate remapping', () => {
	it('gives new highlight IDs, same tags and ranges', () => {
		const original = [range(1, 3)]
		const [copy] = remapHighlightIds(original)
		expect(copy?.id).not.toBe(original[0]?.id)
		expect(copy?.tagId).toBe(a)
		expect(copy?.start).toEqual(original[0]?.start)
	})
	it('follows association only to duplicated passages', () => {
		const map = new Map([['p1', 'p2']])
		expect(remapAssociation({ passageId: 'p1' }, map)).toEqual({ passageId: 'p2' })
		expect(remapAssociation({ passageId: 'x' }, map)).toEqual({ passageId: 'x' })
		expect(remapAssociation(undefined, map)).toBeUndefined()
	})
	it('refuses unsafe pairings', () => {
		expect(
			pairDuplicates([{ id: '1', type: 'passage' }], [{ id: '2', type: 'arrow' }]),
		).toBeUndefined()
		expect(pairDuplicates([{ id: '1', type: 'passage' }], [])).toBeUndefined()
	})
})

describe('deletion impact', () => {
	const model = {
		passages: [{ id: 'p', highlights: 3 }],
		notes: [{ id: 'n1', association: 'p' }, { id: 'n2' }],
		arrows: [
			{ id: 'a1', boundTo: ['p', 'n1'] },
			{ id: 'a2', boundTo: ['n2'] },
			{ id: 'a3', boundTo: [] },
		],
	}
	it('removes highlights and incident arrows with a passage and clears associations', () => {
		const plan = planDeletion({ ...model, selected: ['p'] })
		expect(plan.deleteIds.sort()).toEqual(['a1', 'p'])
		expect(plan.clearAssociationIds).toEqual(['n1'])
		expect(plan.counts).toMatchObject({
			passages: 1,
			highlights: 3,
			arrows: 1,
			clearedAssociations: 1,
		})
		expect(plan.needsConfirmation).toBe(true)
		expect(describeImpact(plan.counts)).toContain('3 highlights')
	})
	it('deleting a note removes its incident arrows only, with no confirmation', () => {
		const plan = planDeletion({ ...model, selected: ['n2'] })
		expect(plan.deleteIds.sort()).toEqual(['a2', 'n2'])
		expect(plan.needsConfirmation).toBe(false)
	})
	it('does not clear associations of notes deleted in the same bulk', () => {
		const plan = planDeletion({ ...model, selected: ['p', 'n1'] })
		expect(plan.clearAssociationIds).toEqual([])
		expect(plan.counts.notes).toBe(1)
	})
	it('a dangling arrow with free ends survives', () => {
		expect(planDeletion({ ...model, selected: ['p'] }).deleteIds).not.toContain('a3')
	})
})

describe('load validation', () => {
	it('keeps valid highlights and reports dangling targets, bad order, and overlaps', () => {
		const dangling: Highlight = {
			id: ulid(),
			tagId: a,
			start: { verse: w(1).verse, token: 9999 },
			end: w(2),
		}
		const reversed = range(5, 3)
		const first = range(1, 4)
		const overlap = range(4, 6)
		const { valid, invalid } = validateHighlights(amosFixture, [first, dangling, reversed, overlap])
		expect(valid).toEqual([first])
		expect(invalid.map((i) => i.highlight.id)).toEqual([dangling.id, reversed.id, overlap.id])
	})
})

describe('tag operations', () => {
	it('reassigns a tag to another and merges adjacent ranges', () => {
		const result = retagHighlights(amosFixture, [range(1, 2, a), range(3, 4, b)], a, b)
		expect(
			result.map((h) => [wordIndex(amosFixture, h.start) + 1, wordIndex(amosFixture, h.end) + 1]),
		).toEqual([[1, 4]])
	})
	it('removes highlights when no target is given', () => {
		expect(retagHighlights(amosFixture, [range(1, 2, a), range(3, 4, b)], a, null)).toHaveLength(1)
	})
	it('orders matches by canvas then word position', () => {
		const matches = orderTagMatches(
			[
				{ id: 'low', x: 0, y: 500, text: amosFixture, highlights: [range(1, 1)] },
				{ id: 'high', x: 0, y: 0, text: amosFixture, highlights: [range(6, 7), range(1, 2)] },
			],
			a,
		)
		expect(matches.map((m) => m.passageId)).toEqual(['high', 'high', 'low'])
		expect(wordIndex(amosFixture, matches[0]?.highlight.start ?? w(1))).toBe(0)
	})
})

describe('shortcut suppression', () => {
	const base = {
		isComposing: false,
		editingShape: false,
		inInteractiveSurface: false,
		popoverOpen: false,
		textSelected: false,
	}
	it('only plain contexts allow canvas shortcuts', () => {
		expect(shortcutsSuppressed(base)).toBe(false)
		for (const key of [
			'isComposing',
			'editingShape',
			'inInteractiveSurface',
			'popoverOpen',
			'textSelected',
		])
			expect(shortcutsSuppressed({ ...base, [key]: true })).toBe(true)
		expect(shortcutsSuppressed({ ...base, keyCode: 229 })).toBe(true)
	})
	it('recognises canvas keys', () => {
		const k = (key: string, meta = false) => ({ key, metaKey: meta, ctrlKey: false, altKey: false })
		expect(isCanvasShortcutKey(k('Delete'))).toBe(true)
		expect(isCanvasShortcutKey(k('ArrowLeft'))).toBe(true)
		expect(isCanvasShortcutKey(k('d', true))).toBe(true)
		expect(isCanvasShortcutKey(k('Enter'))).toBe(false)
	})
})
