import { expect, it } from 'vitest'
import { migrateVersioned, UnsupportedStudyVersion } from './versioning'
it('runs ordered app-owned migrations and leaves newer input untouched', () => {
	const legacy = { schemaVersion: 0, title: 'Old' }
	const migrations = new Map([[0, () => ({ schemaVersion: 1, title: 'Migrated' })]])
	expect(migrateVersioned(legacy, 1, migrations)).toEqual({ schemaVersion: 1, title: 'Migrated' })
	expect(legacy).toEqual({ schemaVersion: 0, title: 'Old' })
	const newer = { schemaVersion: 5 }
	expect(() => migrateVersioned(newer, 1, migrations)).toThrow(UnsupportedStudyVersion)
	expect(newer).toEqual({ schemaVersion: 5 })
})
it('rejects missing and non-advancing migration steps', () => {
	expect(() => migrateVersioned({ schemaVersion: 0 }, 1, new Map())).toThrow('No migration')
	expect(() => migrateVersioned({ schemaVersion: 0 }, 1, new Map([[0, (input) => input]]))).toThrow(
		'exactly one',
	)
})
