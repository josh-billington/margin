import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
	resolve: {
		alias: {
			'@shared': resolve(import.meta.dirname, 'packages/contract/src'),
			'@renderer': resolve(import.meta.dirname, 'src/renderer/src'),
		},
	},
	test: {
		environment: 'node',
		include: [
			'src/**/*.test.ts',
			'scripts/**/*.test.ts',
			'../../src/**/*.test.ts',
			'../../packages/contract/src/**/*.test.ts',
		],
	},
})
