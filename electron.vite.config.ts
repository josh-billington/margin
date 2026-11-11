import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const alias = {
	'@shared': resolve('src/shared'),
	'@renderer': resolve('src/renderer/src'),
}

export default defineConfig({
	main: { resolve: { alias } },
	preload: {
		resolve: { alias },
		// Sandboxed preloads can only require Electron's limited built-ins.
		build: { externalizeDeps: false },
	},
	renderer: {
		optimizeDeps: { exclude: ['@tldraw/assets'] },
		resolve: { alias },
		plugins: [
			react(),
			tailwindcss(),
			{
				name: 'margin-csp-script-hashes',
				transformIndexHtml: {
					order: 'post',
					handler(html) {
						// Vite's React Refresh preamble is inline in development. Trust only its exact bytes.
						const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
							.map((match) => match[1])
							.filter((code) => code?.trim())
							.map(
								(code) =>
									`'sha256-${createHash('sha256')
										.update(code ?? '')
										.digest('base64')}'`,
							)
						return html.replace("script-src 'self'", `script-src 'self' ${hashes.join(' ')}`)
					},
				},
			},
		],
		server: { host: '127.0.0.1' },
	},
})
