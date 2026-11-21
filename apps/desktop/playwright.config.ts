import { defineConfig } from '@playwright/test'

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.ts',
	timeout: 45_000,
	expect: { timeout: 6_000 },
	workers: 1,
	retries: 0,
	reporter: [['list']],
})
