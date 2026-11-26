import js from '@eslint/js'
import tseslint from 'typescript-eslint'

const tests = ['**/*.test.{ts,tsx}']
const nodeOnly = {
	group: ['node:*', 'electron', 'better-sqlite3', 'chokidar'],
	message:
		'Node and Electron modules belong in apps/desktop/src/main. The renderer reaches them through window.margin.',
}
const renderer = {
	group: ['@renderer', '@renderer/*', '@margin/core', '@margin/core/*'],
	message: 'The renderer is UI only. Share code through packages/contract instead.',
}
const rawIpc = {
	name: 'electron',
	importNames: ['ipcMain', 'ipcRenderer', 'contextBridge'],
	message:
		'Raw IPC lives only in main/ipc and the preload. Add the operation to ipcContract in packages/contract/src/ipc.',
}
const restrict = (patterns, paths = []) => ({
	'@typescript-eslint/no-restricted-imports': ['error', { patterns, paths }],
})

export default tseslint.config(
	{
		ignores: [
			'**/data/raw/**',
			'**/out/**',
			'apps/mcp/dist/**',
			'**/release/**',
			'**/test-results/**',
			'**/playwright-report/**',
			'**/node_modules/**',
			'apps/ipad/www/**',
			'apps/ipad/ios/**',
			'site/**',
			'docs/**',
			'video/**',
			'.audit/**',
			'.claude/**',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{ files: ['**/*.{ts,tsx}'], rules: { '@typescript-eslint/consistent-type-imports': 'error' } },
	{
		files: ['packages/services/**/*.{ts,tsx}'],
		rules: {
			'no-restricted-imports': [
				'error',
				{ patterns: ['node:*', 'electron', 'better-sqlite3', 'chokidar'] },
			],
		},
	},
	{
		files: ['packages/core/src/**/*.{ts,tsx}'],
		ignores: tests,
		rules: restrict([
			nodeOnly,
			{
				group: ['@margin/services', '@margin/services/*'],
				message: 'The renderer reaches services through window.margin, never directly.',
			},
		]),
	},
	{
		files: ['packages/contract/src/**/*.ts'],
		ignores: tests,
		rules: restrict([
			nodeOnly,
			renderer,
			{
				group: ['react', 'react-dom', 'react-dom/*', '@margin/services', '@margin/services/*'],
				message:
					'packages/contract holds types, schemas and pure helpers that every process shares.',
			},
			{
				group: ['tldraw'],
				allowTypeImports: true,
				message: 'packages/contract may use tldraw types only.',
			},
		]),
	},
	{
		files: ['apps/desktop/src/main/**/*.ts'],
		ignores: tests,
		rules: restrict([renderer], [rawIpc]),
	},
	{
		files: ['apps/desktop/src/main/ipc/**/*.ts'],
		ignores: tests,
		rules: restrict([renderer]),
	},
	{
		files: ['apps/desktop/src/preload/**/*.ts'],
		rules: restrict([
			renderer,
			{ group: ['better-sqlite3', 'chokidar', '**/main/*'], message: 'The preload is sandboxed.' },
		]),
	},
	// Study JSON read back from disk is inspected loosely in end-to-end tests.
	{ files: ['**/e2e/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
)
