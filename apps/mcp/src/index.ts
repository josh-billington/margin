import { homedir } from 'node:os'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolveLibraryPath } from './library'
import { createServer } from './server'

try {
	const path = await resolveLibraryPath({
		args: process.argv.slice(2),
		env: process.env,
		home: homedir(),
	})
	await createServer(path).connect(new StdioServerTransport())
} catch {
	process.stderr.write('Could not start Margin MCP. Usage: node dist/index.js [--library <dir>]\n')
	process.exitCode = 1
}
