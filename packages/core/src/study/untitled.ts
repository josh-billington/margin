const UNTITLED = 'Untitled study'

/**
 * The title for a new study: "Untitled study", then "Untitled study 2", "Untitled study 3"… with
 * the lowest number no existing study uses, as macOS names new documents.
 */
export function untitledTitle(existing: readonly string[]) {
	const taken = new Set(existing.map((title) => title.trim().toLocaleLowerCase()))
	if (!taken.has(UNTITLED.toLocaleLowerCase())) return UNTITLED
	for (let n = 2; ; n++) {
		const title = `${UNTITLED} ${n}`
		if (!taken.has(title.toLocaleLowerCase())) return title
	}
}
