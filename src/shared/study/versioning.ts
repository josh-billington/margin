import { z } from 'zod'
import { UserFacingError } from '../errors'

export class UnsupportedStudyVersion extends UserFacingError {
	constructor(public readonly requiredVersion: number) {
		super(
			'Margin cannot open this study because it needs a newer version of the app. Update Margin and try again.',
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
		if (!migrate)
			throw new UserFacingError(
				"Margin couldn't update this study's file format. Update Margin and try again.",
			)
		result = migrate(result)
		if (version(result) !== next + 1)
			throw new UserFacingError(
				"Margin couldn't update this study's file format. Update Margin and try again.",
			)
		next++
	}
	return result
}
