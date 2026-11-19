/** Store paths are relative, already validated host paths; only joining is needed. */
export function join(...parts: string[]): string {
	return parts
		.filter(Boolean)
		.join('/')
		.replace(/\/{2,}/g, '/')
}
