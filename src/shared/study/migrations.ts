import { validateDocument } from './validation'
import { studyFileEnvelopeSchema } from './types'
import { migrateVersioned, type StudyMigration } from './versioning'
export { UnsupportedStudyVersion } from './versioning'

// Version 1 is the first on-disk format; no historical upgrades exist yet.
const envelopeMigrations = new Map<number, StudyMigration>()
export function migrateStudy(input: unknown) {
	const study = studyFileEnvelopeSchema.parse(migrateVersioned(input, 1, envelopeMigrations))
	validateDocument(study.document)
	return study
}
export type PersistedStudy = ReturnType<typeof migrateStudy>
