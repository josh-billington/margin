import { expect, it } from 'vitest'
import { sha256, verifyChecksum } from '../../../scripts/import-bible/sources'

it('rejects source checksum mismatches', () => {
	const data = Buffer.from('pinned source')
	expect(verifyChecksum(data, { filename: 'source', sha256: sha256(data) })).toBe(data)
	expect(() =>
		verifyChecksum(Buffer.from('changed source'), { filename: 'source', sha256: sha256(data) }),
	).toThrow('Checksum mismatch')
})

it('does not replace a corrupt cached source by downloading another edition', async () => {
	const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
	const { tmpdir } = await import('node:os')
	const { join } = await import('node:path')
	const { readSource } = await import('../../../scripts/import-bible/sources')
	const directory = await mkdtemp(join(tmpdir(), 'margin-source-'))
	try {
		await writeFile(join(directory, 'source.txt'), 'corrupted cache')
		await expect(
			readSource(
				{
					translationId: 'kjv',
					filename: 'source.txt',
					url: 'https://example.invalid/source',
					revision: 'test',
					retrievedAt: 'test',
					sha256: sha256('expected source'),
					rights: 'test',
					attribution: 'test',
				},
				directory,
			),
		).rejects.toThrow('Checksum mismatch')
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
})
