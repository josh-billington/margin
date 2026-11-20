import { validateDocument } from './validation'
import { z } from 'zod'
import { INK_STUDY_VERSION, STUDY_SCHEMA_VERSION, studyFileEnvelopeSchema } from './types'
import { isDiagramRecord } from './diagrams'
import { migrateVersioned, type StudyMigration } from './versioning'
export { UnsupportedStudyVersion } from './versioning'

const envelopeMigrations = new Map<number, StudyMigration>()
const legacyVersion = z.object({ schemaVersion: z.literal([1, INK_STUDY_VERSION]) })
export function documentVersion(document: {
	store: Readonly<Record<string, unknown>>
}): PersistedStudy['schemaVersion'] {
	let version: PersistedStudy['schemaVersion'] = 1
	for (const record of Object.values(document.store)) {
		if (
			!record ||
			typeof record !== 'object' ||
			!('type' in record) ||
			!('typeName' in record) ||
			record.typeName !== 'shape'
		)
			continue
		if (isDiagramRecord(record)) return STUDY_SCHEMA_VERSION
		if (version === INK_STUDY_VERSION) continue
		if (record.type === 'margin-ink') version = INK_STUDY_VERSION
		if (record.type !== 'margin-note' || !('props' in record)) continue
		const { props } = record
		if (
			props &&
			typeof props === 'object' &&
			'strokes' in props &&
			Array.isArray(props.strokes) &&
			props.strokes.length
		)
			version = INK_STUDY_VERSION
	}
	return version
}
export function migrateStudy(input: unknown) {
	const legacy = legacyVersion.safeParse(input)
	const version = legacy.success ? legacy.data.schemaVersion : STUDY_SCHEMA_VERSION
	const study = studyFileEnvelopeSchema.parse(migrateVersioned(input, version, envelopeMigrations))
	validateDocument(study.document)
	const required = documentVersion(study.document)
	if (study.schemaVersion < required)
		throw new Error(`Study content requires study format version ${required}.`)
	return study
}
export type PersistedStudy = ReturnType<typeof migrateStudy>
