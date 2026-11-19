import { hostname } from 'node:os'
import type { HostIdentity, Diagnostics } from '@margin/services/ports'
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
export const diagnostics: Diagnostics = {
	event: (name, details) => logEvent(name, details),
	failure: (name, error) => logFailure(name, error),
}
