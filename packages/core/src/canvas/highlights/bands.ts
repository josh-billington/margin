/** A box in the passage's own (unzoomed) CSS pixels, relative to `container`. */
export type Band = { x: number; y: number; w: number; h: number }

/** Word elements whose index (in `words()` order) lies in [lo, hi]; DOM order matches that order. */
export function wordElements(root: ParentNode, lo: number, hi: number) {
	return Array.from(root.querySelectorAll('[data-word]')).slice(lo, hi + 1)
}

/** Screen rect covering every given element; null if none are laid out. */
export function unionRect(elements: Element[]) {
	let left = Infinity,
		top = Infinity,
		right = -Infinity,
		bottom = -Infinity
	for (const element of elements)
		for (const r of element.getClientRects()) {
			if (!r.width && !r.height) continue
			left = Math.min(left, r.left)
			top = Math.min(top, r.top)
			right = Math.max(right, r.right)
			bottom = Math.max(bottom, r.bottom)
		}
	return left === Infinity ? null : new DOMRect(left, top, right - left, bottom - top)
}

/**
 * One continuous band per line across the given words, bridging the spaces and verse numbers
 * between them (like a native text selection, unlike per-word backgrounds).
 */
export function lineBands(container: HTMLElement, elements: Element[]): Band[] {
	const origin = container.getBoundingClientRect()
	if (!origin.width) return []
	const scale = container.offsetWidth / origin.width
	const lines: { left: number; top: number; right: number; bottom: number }[] = []
	for (const element of elements)
		for (const r of element.getClientRects()) {
			if (!r.width) continue
			const line = lines.find((l) => r.top < l.bottom && r.bottom > l.top)
			if (!line) lines.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
			else {
				line.left = Math.min(line.left, r.left)
				line.right = Math.max(line.right, r.right)
				line.top = Math.min(line.top, r.top)
				line.bottom = Math.max(line.bottom, r.bottom)
			}
		}
	return lines.map((l) => ({
		x: (l.left - origin.left) * scale,
		y: (l.top - origin.top) * scale,
		w: (l.right - l.left) * scale,
		h: (l.bottom - l.top) * scale,
	}))
}
