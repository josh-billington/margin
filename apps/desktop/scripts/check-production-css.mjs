import { readFile, readdir } from 'node:fs/promises'
import process from 'node:process'
import { URL } from 'node:url'
import { parse } from 'postcss'

const assets = new URL('../out/renderer/assets/', import.meta.url)
const files = (await readdir(assets)).filter((name) => name.endsWith('.css'))
const generic =
	/\.(?:absolute|block|blur|collapse|container|ease-out|fixed|flex|grid|grow|hidden|inline|italic|outline|relative|resize|ring|static|sticky|transform|transition|visible)(?![\w-])/g
const unexpected = new Set()
let hasScreenReaderUtility = false

for (const file of files) {
	const stylesheet = parse(await readFile(new URL(file, assets), 'utf8'), { from: file })
	stylesheet.walkRules((rule) => {
		for (const match of rule.selector.matchAll(generic)) unexpected.add(match[0])
		if (rule.selectors.includes('.sr-only')) hasScreenReaderUtility = true
	})
}

if (unexpected.size || !hasScreenReaderUtility) {
	throw new Error(
		`Unexpected production CSS. Generic utilities: ${[...unexpected].sort().join(', ') || 'none'}. Screen-reader utility emitted: ${hasScreenReaderUtility}.`,
	)
}

process.stdout.write(`Checked ${files.length} production stylesheet(s) for generic utilities.\n`)
