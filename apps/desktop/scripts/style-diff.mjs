// Compares two computed-style captures from e2e/style-snapshot.e2e.ts.
// Usage: node scripts/style-diff.mjs <before-folder> <after-folder> [--limit 40]
// Exits 1 when anything differs: a changed property, or an element only one side has.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const [before, after] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const limitAt = process.argv.indexOf('--limit')
const limit = limitAt > 0 ? Number(process.argv[limitAt + 1]) : 40
if (!before || !after) {
	process.stderr.write('Usage: node scripts/style-diff.mjs <before> <after> [--limit n]\n')
	process.exit(2)
}

const load = async (dir, file) => JSON.parse(await readFile(join(dir, file), 'utf8'))
const files = [...new Set([...(await readdir(before)), ...(await readdir(after))])]
	.filter((f) => f.endsWith('.json'))
	.sort()

let total = 0
for (const file of files) {
	let a, b
	try {
		;[a, b] = [await load(before, file), await load(after, file)]
	} catch {
		process.stdout.write(`${file}: only in one capture\n`)
		total++
		continue
	}
	const lines = []
	for (const path of Object.keys(a)) if (!(path in b)) lines.push(`  - removed ${path}`)
	for (const path of Object.keys(b)) if (!(path in a)) lines.push(`  + added   ${path}`)
	for (const [path, style] of Object.entries(a)) {
		const next = b[path]
		if (!next) continue
		// A custom property changed on an ancestor shows up on every descendant that inherits it:
		// report it once, where it changed, not on each element below.
		const parent = path.includes('::')
			? path.slice(0, path.indexOf('::'))
			: path.includes('>')
				? path.slice(0, path.lastIndexOf('>'))
				: 'html'
		const inherited = (name) =>
			name.startsWith('--') &&
			a[parent]?.[name] === style[name] &&
			b[parent]?.[name] === next[name] &&
			parent !== path
		for (const name of new Set([...Object.keys(style), ...Object.keys(next)]))
			if (style[name] !== next[name] && !inherited(name))
				lines.push(`  ~ ${path} { ${name}: ${style[name] ?? '∅'} → ${next[name] ?? '∅'} }`)
	}
	if (lines.length) {
		total += lines.length
		process.stdout.write(
			`${file}: ${lines.length} difference(s)\n${lines.slice(0, limit).join('\n')}\n`,
		)
		if (lines.length > limit) process.stdout.write(`  … ${lines.length - limit} more\n`)
	}
}
process.stdout.write(
	total
		? `\n${total} difference(s) across ${files.length} captures.\n`
		: `No differences across ${files.length} captures.\n`,
)
process.exit(total ? 1 : 0)
