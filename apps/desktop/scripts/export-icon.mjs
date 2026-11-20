/**
 * Rebuild the app and website icons from the two sources in resources/icon:
 * margin.svg (paper tile) and margin-dark.svg (night tile).
 * Run: node apps/desktop/scripts/export-icon.mjs [path/to/node_modules/sharp]
 * Sharp is not a project dependency; pass its path or set SHARP_PATH.
 */
import { createRequire } from 'node:module'
import process from 'node:process'
import console from 'node:console'
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sharpPath = process.argv[2] ?? process.env.SHARP_PATH
if (!sharpPath) throw new Error('Pass the path to a sharp install, or set SHARP_PATH.')
const sharp = createRequire(import.meta.url)(resolve(sharpPath))
const icons = [
	['margin', await readFile(join(root, 'resources/icon/margin.svg'))],
	['margin-dark', await readFile(join(root, 'resources/icon/margin-dark.svg'))],
]
for (const [name, input] of icons)
	for (const size of [256, 1024])
		await sharp(input, { density: 600 })
			.resize(size, size)
			.png()
			.toFile(join(root, `resources/icon/${name}-${size}.png`))
// The website uses the night tile.
await copyFile(join(root, 'resources/icon/margin-dark.svg'), join(root, '../../site/app/icon.svg'))

if (process.platform === 'darwin') {
	for (const [name, input] of icons) {
		const temporary = await mkdtemp(join(tmpdir(), 'margin-icon-'))
		const iconset = join(temporary, 'Margin.iconset')
		try {
			await mkdir(iconset)
			for (const size of [16, 32, 128, 256, 512]) {
				for (const scale of [1, 2]) {
					const suffix = scale === 2 ? '@2x' : ''
					await sharp(input, { density: 600 })
						.resize(size * scale, size * scale)
						.png()
						.toFile(join(iconset, `icon_${size}x${size}${suffix}.png`))
				}
			}
			execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(root, `resources/icon/${name}.icns`)])
		} finally {
			await rm(temporary, { recursive: true, force: true })
		}
	}
}
console.log('Exported Margin PNGs, website SVG, and macOS ICNS (on macOS).')
