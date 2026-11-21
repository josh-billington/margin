import { expect, test } from 'vitest'
import { FileError } from '@margin/services/ports'
import { fileError } from './fileErrors'

test('maps native Filesystem failures without disguising unknown failures', () => {
	for (const [code, message, kind] of [
		['OS-PLUG-FILE-0008', 'missing file', 'missing'],
		['OS-PLUG-FILE-0011', 'missing parent', 'missing'],
		['OS-PLUG-FILE-0010', 'directory exists', 'exists'],
		[
			'OS-PLUG-FILE-0013',
			'The file couldn’t be saved because you don’t have permission.',
			'denied',
		],
		['OS-PLUG-FILE-0013', 'Read-only file system', 'readOnly'],
		['OS-PLUG-FILE-0013', 'No space left on device', 'full'],
		['OS-PLUG-FILE-0013', 'The file couldn’t be saved because there isn’t enough space.', 'full'],
	]) {
		const cause = { code, message }
		expect(fileError({ error: cause, path: 'study.json' })).toMatchObject({
			kind,
			path: 'study.json',
			cause,
		})
	}
	const unknown = new Error('bridge unavailable')
	expect(fileError({ error: unknown, path: '' })).toBe(unknown)
	const known = new FileError('missing', 'file')
	expect(fileError({ error: known, path: 'other' })).toBe(known)
})
