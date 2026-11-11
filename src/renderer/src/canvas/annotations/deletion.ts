import type { BlockNoun } from '../../insertion/labels'

export interface DeletionModel {
	/** Shape IDs the user chose to delete. */
	selected: readonly string[]
	passages: readonly { id: string; highlights: number; noun?: BlockNoun }[]
	notes: readonly { id: string; association?: string }[]
	/** Every arrow with the shape IDs its terminals are bound to. */
	arrows: readonly { id: string; boundTo: readonly string[] }[]
}

export interface DeletionPlan {
	/** Selected shapes plus incident arrows. */
	deleteIds: string[]
	/** Surviving notes whose passage association must be cleared. */
	clearAssociationIds: string[]
	counts: {
		passages: number
		/** What the single deleted block holds; null when several blocks are deleted. */
		passageNoun: BlockNoun | null
		notes: number
		highlights: number
		/** Arrows removed only because an endpoint was deleted. */
		incidentArrows: number
		arrows: number
		clearedAssociations: number
	}
	needsConfirmation: boolean
}

export function planDeletion(model: DeletionModel): DeletionPlan {
	const selected = new Set(model.selected)
	const passages = model.passages.filter((p) => selected.has(p.id))
	const passageIds = new Set(passages.map((p) => p.id))
	const notes = model.notes.filter((n) => selected.has(n.id))
	const removedIds = new Set([...passageIds, ...notes.map((n) => n.id)])
	const arrows = model.arrows.filter((a) => selected.has(a.id))
	const incident = model.arrows.filter(
		(a) => !selected.has(a.id) && a.boundTo.some((id) => removedIds.has(id)),
	)
	const clear = model.notes.filter(
		(n) => !selected.has(n.id) && n.association !== undefined && passageIds.has(n.association),
	)
	return {
		deleteIds: [...new Set([...model.selected, ...incident.map((a) => a.id)])],
		clearAssociationIds: clear.map((n) => n.id),
		counts: {
			passages: passages.length,
			passageNoun: passages.length === 1 ? (passages[0]?.noun ?? null) : null,
			notes: notes.length,
			highlights: passages.reduce((sum, p) => sum + p.highlights, 0),
			incidentArrows: incident.length,
			arrows: arrows.length + incident.length,
			clearedAssociations: clear.length,
		},
		needsConfirmation: passages.length > 0,
	}
}

export function describeImpact(counts: DeletionPlan['counts']) {
	const noun = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
	const block = counts.passageNoun
		? `${counts.passageNoun.replace(/s$/, '')} block`
		: 'scripture block'
	const parts = [noun(counts.passages, block)]
	if (counts.notes) parts.push(noun(counts.notes, 'note'))
	if (counts.highlights) parts.push(noun(counts.highlights, 'highlight'))
	if (counts.arrows) parts.push(noun(counts.arrows, 'arrow'))
	const list = new Intl.ListFormat('en', { type: 'conjunction' }).format(parts)
	const lines = [`This removes ${list}.`]
	if (counts.clearedAssociations)
		lines.push(`${noun(counts.clearedAssociations, 'note')} will stay, no longer kept with verses.`)
	return lines.join(' ')
}
