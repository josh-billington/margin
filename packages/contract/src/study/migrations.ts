import { validateDocument } from './validation'
import { STUDY_SCHEMA_VERSION, studyFileEnvelopeSchema } from './types'
import { migrateVersioned, type StudyMigration } from './versioning'
export { UnsupportedStudyVersion } from './versioning'

// Version 1 is the first on-disk format; no historical upgrades exist yet.
const envelopeMigrations = new Map<number, StudyMigration>()
export function migrateStudy(input: unknown) {
	const study = studyFileEnvelopeSchema.parse(
		migrateVersioned(input, STUDY_SCHEMA_VERSION, envelopeMigrations),
	)
	validateDocument(study.document)
	return study
}
export type PersistedStudy = ReturnType<typeof migrateStudy>
