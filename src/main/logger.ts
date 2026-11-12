import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function createLogger(directory: string, maxBytes = 1024 * 1024) {
	const path = join(directory, 'main.log')
	const write = (event: string, details: Record<string, string | number> = {}) => {
		try {
			mkdirSync(directory, { recursive: true })
			if (existsSync(path) && statSync(path).size >= maxBytes)
				renameSync(path, join(directory, 'main.old.log'))
			appendFileSync(path, `${new Date().toISOString()} ${JSON.stringify({ event, ...details })}\n`)
		} catch {
			return
		}
	}
	return { path, write }
}

let logger: ReturnType<typeof createLogger> | undefined

export function initializeLogging(directory: string) {
	logger = createLogger(directory)
}

export function logEvent(event: string, details?: Record<string, string | number>) {
	logger?.write(event, details)
}

export function logFailure(event: string, error: unknown) {
	logEvent(event, {
		kind: error instanceof Error ? error.name : typeof error,
		code:
			error instanceof Error && 'code' in error && typeof error.code === 'string'
				? error.code
				: 'unknown',
	})
}
