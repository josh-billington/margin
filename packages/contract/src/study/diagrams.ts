export function isDiagramRecord(record: { type: unknown; meta?: unknown }) {
	return (
		(record.type === 'geo' || record.type === 'line' || record.type === 'text') &&
		!!record.meta &&
		typeof record.meta === 'object' &&
		'marginDiagram' in record.meta &&
		record.meta.marginDiagram === true
	)
}
