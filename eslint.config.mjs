import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
	{
		ignores: ['data/raw/**', 'out/**', 'release/**', 'test-results/**', 'playwright-report/**', 'node_modules/**', 'site/**', '.claude/**'],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{ files: ['**/*.{ts,tsx}'], rules: { '@typescript-eslint/consistent-type-imports': 'error' } },
	// Study JSON read back from disk is inspected loosely in end-to-end tests.
	{ files: ['e2e/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
)
