import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { bookIdSchema, translationIdSchema } from '../../src/shared/bible/types'

export const sourcePinSchema = z.object({
	translationId: translationIdSchema,
	book: bookIdSchema.optional(),
	filename: z.string().regex(/^[a-zA-Z0-9_.-]+$/),
	url: z.url(),
	upstreamUrl: z.url().optional(),
	revision: z.string(),
	retrievedAt: z.string(),
	sha256: z.string().regex(/^[a-f0-9]{64}$/),
	rights: z.string(),
	attribution: z.string(),
	versionSource: z.string().optional(),
})
export const sourceFileSchema = z.object({
	schemaVersion: z.literal(1),
	sefariaIndexRevision: z.string(),
	sources: z.array(sourcePinSchema).min(1),
})
export type SourcePin = z.infer<typeof sourcePinSchema>
export const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex')
export function verifyChecksum(data: Buffer, pin: Pick<SourcePin, 'sha256' | 'filename'>): Buffer {
	const actual = sha256(data)
	if (actual !== pin.sha256)
		throw new Error(
			`Checksum mismatch for ${pin.filename}: expected ${pin.sha256}, received ${actual}. No corpus was replaced.`,
		)
	return data
}

/** Called only by the explicit import command. Cached corruption never triggers a replacement download. */
export async function readSource(
	pin: Pick<SourcePin, 'filename' | 'sha256' | 'url'> & Partial<SourcePin>,
	rawDirectory: string,
): Promise<Buffer> {
	const path = join(rawDirectory, pin.filename)
	try {
		return verifyChecksum(await readFile(path), pin)
	} catch (error) {
		if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
	}
	const response = await fetch(pin.url, { signal: AbortSignal.timeout(120_000) })
	if (!response.ok) throw new Error(`Download failed ${response.status}: ${pin.url}`)
	const data = verifyChecksum(Buffer.from(await response.arrayBuffer()), pin)
	await mkdir(rawDirectory, { recursive: true })
	await writeFile(path, data)
	return data
}
