import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
	{
		ignores: [
			'**/data/raw/**',
			'**/out/**',
			'apps/mcp/dist/**',
			'**/release/**',
			'**/test-results/**',
			'**/playwright-report/**',
			'**/storybook-static/**',
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
	// Study JSON read back from disk is inspected loosely in end-to-end tests.
	{ files: ['**/e2e/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
)
