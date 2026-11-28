import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CSSProperties, ReactNode } from 'react'
import tokensCss from './tokens.css?raw'

/** Token names in the first `:root` block, in file order, so the catalogue follows tokens.css. */
const names = [
	...(tokensCss
		.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf('\n}'))
		.matchAll(/(--[\w-]+):/g) ?? []),
].map((m) => m[1]!)

const group = (test: (name: string) => boolean) => names.filter(test)
const isSize = (name: string) =>
	/^--(text|space|control|row|radius|stroke|sheet|insert|titlebar|sidebar|toolbar)/.test(name)
const isMotion = (name: string) => /^--(duration|ease)/.test(name)
const isShadow = (name: string) => /^--(shadow|edge)/.test(name)
const isFont = (name: string) => name.startsWith('--font')
const isOther = (name: string) => /opacity$/.test(name)
const colours = group(
	(n) => !isSize(n) && !isMotion(n) && !isShadow(n) && !isFont(n) && !isOther(n),
)

const grid: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
	gap: 'var(--space-5)',
}
const label: CSSProperties = { font: '500 var(--text-sm)/1.3 var(--font-ui)', color: 'var(--ink)' }
const value = (name: string) =>
	getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section style={{ marginBottom: 'var(--space-7)' }}>
			<h2 style={{ font: '600 var(--text-lg)/1.3 var(--font-ui)', margin: '0 0 var(--space-5)' }}>
				{title}
			</h2>
			{children}
		</section>
	)
}

function Row({ name, sample }: { name: string; sample: ReactNode }) {
	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
			{sample}
			<div style={{ minWidth: 0 }}>
				<div style={label}>{name}</div>
				<div style={{ font: '400 var(--text-xs)/1.3 var(--font-ui)', color: 'var(--text-muted)' }}>
					{value(name)}
				</div>
			</div>
		</div>
	)
}

function Tokens() {
	return (
		<>
			<Section title="Colour">
				<div style={grid}>
					{colours.map((name) => (
						<Row
							key={name}
							name={name}
							sample={
								<span
									style={{
										width: 32,
										height: 32,
										flex: 'none',
										borderRadius: 'var(--radius-sm)',
										background: `var(${name})`,
										boxShadow: 'inset 0 0 0 1px var(--hairline)',
									}}
								/>
							}
						/>
					))}
				</div>
			</Section>
			<Section title="Type">
				{group(
					(n) =>
						n.startsWith('--text-') &&
						!n.includes('muted') &&
						!n.includes('scripture') &&
						!n.includes('selection'),
				).map((name) => (
					<Row
						key={name}
						name={name}
						sample={<span style={{ fontSize: `var(${name})`, width: 120 }}>Verse 12</span>}
					/>
				))}
				<Row
					name="--font-hand"
					sample={<span style={{ font: '400 18px var(--font-hand)', width: 120 }}>Note</span>}
				/>
			</Section>
			<Section title="Space and size">
				<div style={{ display: 'grid', gap: 'var(--space-3)' }}>
					{group((n) => isSize(n) && !/^--(text|radius)/.test(n)).map((name) => (
						<Row
							key={name}
							name={name}
							sample={
								<span
									style={{
										height: 8,
										width: `var(${name})`,
										minWidth: 1,
										background: 'var(--accent)',
									}}
								/>
							}
						/>
					))}
				</div>
			</Section>
			<Section title="Radius">
				<div style={grid}>
					{group((n) => n.startsWith('--radius')).map((name) => (
						<Row
							key={name}
							name={name}
							sample={
								<span
									style={{
										width: 40,
										height: 40,
										flex: 'none',
										borderRadius: `var(${name})`,
										background: 'var(--surface)',
										boxShadow: 'inset 0 0 0 1px var(--border)',
									}}
								/>
							}
						/>
					))}
				</div>
			</Section>
			<Section title="Elevation">
				<div style={grid}>
					{group(isShadow).map((name) => (
						<Row
							key={name}
							name={name}
							sample={
								<span
									style={{
										width: 48,
										height: 32,
										flex: 'none',
										borderRadius: 'var(--radius-md)',
										background: 'var(--surface)',
										boxShadow: `var(${name})`,
									}}
								/>
							}
						/>
					))}
				</div>
			</Section>
			<Section title="Opacity">
				{group(isOther).map((name) => (
					<Row key={name} name={name} sample={<span style={{ width: 0 }} />} />
				))}
			</Section>
			<Section title="Motion">
				{group(isMotion).map((name) => (
					<Row key={name} name={name} sample={<span style={{ width: 0 }} />} />
				))}
			</Section>
		</>
	)
}

const meta: Meta<typeof Tokens> = {
	title: 'Foundations/Tokens',
	component: Tokens,
	parameters: { a11y: { test: 'todo' } },
}
export default meta

export const All: StoryObj<typeof Tokens> = {}
