import { createHash } from 'node:crypto'
import { hostname } from 'node:os'
import { inflateRawSync } from 'node:zlib'
import type { HostIdentity, Diagnostics, Hasher, Codec } from '@margin/services/ports'
import { logEvent, logFailure } from '../logger'

export const host: HostIdentity = {
	current: () => ({ pid: process.pid, hostname: hostname(), acquiredAt: new Date().toISOString() }),
	isAlive: (owner) => {
		try {
			process.kill(owner.pid, 0)
			return true
		} catch (error) {
			return !(error instanceof Error && 'code' in error && error.code === 'ESRCH')
		}
	},
}
export const clock = { now: () => Date.now() }
// Native SHA-256 and inflate: the portable JS versions in services are for hosts without Node.
export const hasher: Hasher = {
	sha256Hex: (data) => createHash('sha256').update(data).digest('hex'),
}
export const codec: Codec = { inflateRaw: (data) => inflateRawSync(data) }
export const diagnostics: Diagnostics = {
	event: (name, details) => logEvent(name, details),
	failure: (name, error) => logFailure(name, error),
}
