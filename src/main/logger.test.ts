import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createLogger, initializeLogging, logFailure, stackFrames } from './logger'

const root = mkdtempSync(join(tmpdir(), 'margin-logs-'))
afterEach(() => rmSync(root, { recursive: true, force: true }))

it('appends timestamped diagnostics and rotates at the cap', () => {
	const logger = createLogger(root, 1)
	logger.write('app-start', { version: '0.9.0-beta.1' })
	expect(readFileSync(logger.path, 'utf8')).toMatch(/^\d{4}-\d\d-\d\dT.*app-start/)
	logger.write('renderer-unresponsive')
	expect(readFileSync(join(root, 'main.old.log'), 'utf8')).toContain('app-start')
	expect(readFileSync(logger.path, 'utf8')).toContain('renderer-unresponsive')
	logger.write('render-process-gone')
	expect(readFileSync(join(root, 'main.old.log'), 'utf8')).not.toContain('app-start')
})

it('does not log error messages, stacks, or private study contents', () => {
	initializeLogging(root)
	logFailure(
		'save-failed',
		Object.assign(new Error('PRIVATE STUDY /Users/name/file'), { code: 'EACCES' }),
	)
	const output = readFileSync(join(root, 'main.log'), 'utf8')
	expect(output).toContain('EACCES')
	expect(output).not.toContain('PRIVATE')
	expect(output).not.toContain('/Users/')
})

it('appends without truncating earlier entries below the cap', () => {
	const logger = createLogger(root)
	logger.write('app-start')
	logger.write('renderer-unresponsive')
	const output = readFileSync(logger.path, 'utf8')
	expect(output.trim().split('\n')).toHaveLength(2)
	expect(output).toContain('app-start')
	expect(output).toContain('renderer-unresponsive')
})

it('never throws if the logs directory cannot be written', () => {
	writeFileSync(root, 'not a directory')
	expect(() => createLogger(root).write('app-start')).not.toThrow()
})

describe('stackFrames', () => {
	it('keeps code locations and drops the message line', () => {
		const error = new Error('private study words')
		error.stack =
			'Error: private study words\n    at save (/app/out/main/index.js:10:5)\n    at run (/app/out/main/index.js:20:1)'
		const frames = stackFrames(error)
		expect(frames).toBe(
			'at save (/app/out/main/index.js:10:5) | at run (/app/out/main/index.js:20:1)',
		)
		expect(frames).not.toContain('private')
	})
})
