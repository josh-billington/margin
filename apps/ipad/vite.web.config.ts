import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const workspace = resolve(import.meta.dirname, '../..')
const app = import.meta.dirname

export default defineConfig({
	root: resolve(workspace, 'packages/core'),
	base: './',
	envDir: workspace,
	define: { __IPAD_PROBE__: process.env.MARGIN_IPAD_PROBE === '1' },
	optimizeDeps: { exclude: ['@tldraw/assets'] },
	resolve: {
		alias: {
			'@shared': resolve(workspace, 'packages/contract/src'),
			'@renderer': resolve(workspace, 'packages/core/src'),
		},
	},
	plugins: [
		{
			name: 'margin-capacitor-entry',
			enforce: 'pre',
			resolveId: (id, importer) =>
				id === '/src/main.tsx' && importer?.endsWith('index.html')
					? resolve(app, 'src/entry.ts')
					: null,
			async closeBundle() {
				const target = resolve(app, 'www/assets/databases')
				await mkdir(target, { recursive: true })
				for (const corpus of ['bible', 'lexicon'])
					await copyFile(
						resolve(workspace, `apps/desktop/resources/${corpus}/margin-${corpus}.sqlite`),
						resolve(target, `margin-${corpus}SQLite.db`),
					)
			},
		},
		react(),
		tailwindcss(),
	],
	build: { outDir: resolve(app, 'www'), emptyOutDir: true },
})
