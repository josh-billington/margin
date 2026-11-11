import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8')

/** Custom properties declared in the first block whose selector starts with `selector`. */
function block(selector: string): Record<string, string> {
	const start = css.indexOf(`${selector} {`)
	expect(start, selector).toBeGreaterThanOrEqual(0)
	const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start))
	return Object.fromEntries(
		[...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]!.trim()]),
	)
}
const dark = block(':root')
const light = { ...dark, ...block(":root[data-appearance='light']") }

const channel = (v: number) => {
	const c = v / 255
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = (hex: string) => {
	const digits = hex.slice(1)
	const n = Number.parseInt(
		digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits,
		16,
	)
	return (
		0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
	)
}
/** WCAG 2.x contrast ratio between two #rrggbb colors. */
function contrast(a: string, b: string) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
	return (hi + 0.05) / (lo + 0.05)
}

const tags = ['sky', 'violet', 'rose', 'coral', 'amber', 'green']
const themes = { dark, light }

describe.each(Object.entries(themes))('%s tokens', (_name, tokens) => {
	// Scripture text and chrome copy sit on the canvas, the chrome background, or a floating surface.
	const backgrounds = ['--canvas-bg', '--chrome-bg', '--surface']
	it.each(backgrounds)('tag colors reach 4.5:1 on %s', (bg) => {
		for (const tag of tags)
			expect(contrast(tokens[`--${tag}`]!, tokens[bg]!), tag).toBeGreaterThanOrEqual(4.5)
	})
	it.each(backgrounds)('text tokens reach 4.5:1 on %s', (bg) => {
		for (const token of ['--ink', '--pen', '--text-scripture', '--text-muted', '--accent'])
			expect(contrast(tokens[token]!, tokens[bg]!), token).toBeGreaterThanOrEqual(4.5)
	})
	it('text on a solid accent fill reaches 4.5:1', () => {
		expect(contrast(tokens['--accent-ink']!, tokens['--accent']!)).toBeGreaterThanOrEqual(4.5)
	})
	it('menu highlight text reaches 4.5:1', () => {
		expect(contrast(tokens['--on-accent']!, tokens['--accent-fill']!)).toBeGreaterThanOrEqual(4.5)
	})
})

describe('light overrides', () => {
	it('defines every dark token that is themed', () => {
		const overrides = block(":root[data-appearance='light']")
		for (const token of ['--canvas-bg', '--ink', '--glass-scrim', '--focus-dim', '--hairline'])
			expect(overrides[token], token).toBeDefined()
		for (const tag of tags) {
			expect(overrides[`--${tag}`], tag).toBeDefined()
			expect(overrides[`--${tag}-tint`], tag).toBeDefined()
		}
	})
})
