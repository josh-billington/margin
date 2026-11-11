/** Rebuild the app and website icons: node scripts/export-icon.mjs (requires site/npm install). */
import { createRequire } from 'node:module'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import console from 'node:console'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sharp = createRequire(join(root, 'site/package.json'))('sharp')
const source = await readFile(join(root, 'resources/icon/margin.svg'))
const dark = source.toString().replace('fill="#EAE0CE"', 'fill="#2D2832"')
await writeFile(join(root, 'resources/icon/margin-dark.svg'), dark)
for (const [name, input] of [
	['margin', source],
	['margin-dark', dark],
])
	for (const size of [256, 1024])
		await sharp(Buffer.from(input))
			.resize(size, size)
			.png()
			.toFile(join(root, `resources/icon/${name}-${size}.png`))
await copyFile(join(root, 'resources/icon/margin.svg'), join(root, 'site/app/icon.svg'))

if (process.platform === 'darwin') {
	const temporary = await mkdtemp(join(tmpdir(), 'margin-icon-'))
	const iconset = join(temporary, 'Margin.iconset')
	try {
		await mkdir(iconset)
		for (const [name, input] of [
			['margin', source],
			['margin-dark', Buffer.from(dark)],
		]) {
			for (const size of [16, 32, 128, 256, 512]) {
				for (const scale of [1, 2]) {
					const suffix = scale === 2 ? '@2x' : ''
					await sharp(input)
						.resize(size * scale, size * scale)
						.png()
						.toFile(join(iconset, `icon_${size}x${size}${suffix}.png`))
				}
			}
			execFileSync('iconutil', [
				'-c',
				'icns',
				iconset,
				'-o',
				join(root, `resources/icon/${name}.icns`),
			])
		}
	} finally {
		await rm(temporary, { recursive: true, force: true })
	}
}
console.log('Exported Margin PNG, website SVG, and macOS ICNS (on macOS).')
