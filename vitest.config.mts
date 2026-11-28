import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
	resolve: {
		alias: {
			'@shared': resolve(import.meta.dirname, 'packages/contract/src'),
			'@renderer': resolve(import.meta.dirname, 'packages/core/src'),
		},
	},
	test: {
		environment: 'node',
		include: [
			'src/**/*.test.ts',
			'scripts/**/*.test.ts',
			'../../packages/core/src/**/*.test.ts',
			'../../packages/contract/src/**/*.test.ts',
			'../../packages/services/src/**/*.test.ts',
			'../../packages/ui/src/**/*.test.ts',
		],
	},
})
