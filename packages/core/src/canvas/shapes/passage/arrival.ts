import { atom } from 'tldraw'
import type { TLShapeId } from 'tldraw'

/**
 * Blocks that were just added. `pending` keeps a block unseen until it has measured and been put
 * in its place; `in` fades it in there (canvas.css). Never written to the document.
 */
export type Arrival = 'pending' | 'in'

export const arrivals = atom<ReadonlyMap<TLShapeId, Arrival>>('arrivals', new Map())

export function setArrival(ids: readonly TLShapeId[], arrival: Arrival | null) {
	const next = new Map(arrivals.get())
	for (const id of ids) {
		if (arrival) next.set(id, arrival)
		else next.delete(id)
	}
	arrivals.set(next)
}
