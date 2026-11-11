import { z } from 'zod'

export class UnsupportedStudyVersion extends Error {
	constructor(public readonly requiredVersion: number) {
		super(
			`This study requires Margin study schema ${requiredVersion}; this app supports 1. Update Margin to open it.`,
		)
	}
}
const version = (input: unknown) =>
	z.object({ schemaVersion: z.number().int().nonnegative() }).parse(input).schemaVersion
export type StudyMigration = (input: unknown) => unknown

// Each entry upgrades exactly one app-owned schema version. Historical migrations
// remain here when future versions ship; SDK record migration stays with tldraw.
export function migrateVersioned(
	input: unknown,
	current: number,
	migrations: ReadonlyMap<number, StudyMigration>,
) {
	let result = input
	let next = version(result)
	if (next > current) throw new UnsupportedStudyVersion(next)
	while (next < current) {
		const migrate = migrations.get(next)
		if (!migrate) throw new Error(`No migration is available for study schema ${next}.`)
		result = migrate(result)
		if (version(result) !== next + 1)
			throw new Error('A study migration must advance exactly one schema version.')
		next++
	}
	return result
}
