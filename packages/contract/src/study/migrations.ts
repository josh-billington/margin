import { validateDocument } from './validation'
import { z } from 'zod'
import { STUDY_SCHEMA_VERSION, studyFileEnvelopeSchema } from './types'
import { migrateVersioned, type StudyMigration } from './versioning'
export { UnsupportedStudyVersion } from './versioning'

const envelopeMigrations = new Map<number, StudyMigration>()
const legacyVersion = z.object({ schemaVersion: z.literal(1) })
export function documentVersion(document: {
	store: Readonly<Record<string, unknown>>
}): PersistedStudy['schemaVersion'] {
	for (const record of Object.values(document.store)) {
		if (
			!record ||
			typeof record !== 'object' ||
			!('type' in record) ||
			!('typeName' in record) ||
			record.typeName !== 'shape'
		)
			continue
		if (record.type === 'margin-ink') return STUDY_SCHEMA_VERSION
		if (record.type !== 'margin-note' || !('props' in record)) continue
		const { props } = record
		if (
			props &&
			typeof props === 'object' &&
			'strokes' in props &&
			Array.isArray(props.strokes) &&
			props.strokes.length
		)
			return STUDY_SCHEMA_VERSION
	}
	return 1
}
export function migrateStudy(input: unknown) {
	const version = legacyVersion.safeParse(input).success ? 1 : STUDY_SCHEMA_VERSION
	const study = studyFileEnvelopeSchema.parse(migrateVersioned(input, version, envelopeMigrations))
	validateDocument(study.document)
	if (study.schemaVersion < documentVersion(study.document))
		throw new Error('Ink requires study format version 2.')
	return study
}
export type PersistedStudy = ReturnType<typeof migrateStudy>
