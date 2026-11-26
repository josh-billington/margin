/** One launch of one build: startup plus the scripted interactions on the heavy study. */
export interface Sample {
	build: 'base' | 'head'
	round: number
	startupMs: number
	zoom: Interaction
	pan: Interaction
	typing: Interaction & { keyP95Ms: number; keyMaxMs: number; mainDelayP95Ms: number }
}

/** Chromium's own CPU accounting over the window, plus RAF intervals for context. */
export interface Interaction {
	styleMs: number
	layoutMs: number
	scriptMs: number
	taskMs: number
	frameP95Ms: number
	framesOver33: number
}

interface Budget {
	name: string
	read: (sample: Sample) => number
	/** Fractional slowdown allowed against the base median. */
	tolerance: number
	/** Absolute slowdown below which a change is noise, whatever the ratio. */
	floorMs: number
}

export const budgets: Budget[] = [
	{ name: 'startup to first verse block', read: (s) => s.startupMs, tolerance: 0.2, floorMs: 250 },
	{ name: 'zoom: style recalculation', read: (s) => s.zoom.styleMs, tolerance: 0.25, floorMs: 40 },
	{ name: 'zoom: renderer task time', read: (s) => s.zoom.taskMs, tolerance: 0.25, floorMs: 80 },
	{ name: 'pan: renderer task time', read: (s) => s.pan.taskMs, tolerance: 0.25, floorMs: 80 },
	{
		name: 'typing: key to paint p95',
		read: (s) => s.typing.keyP95Ms,
		tolerance: 0.25,
		floorMs: 15,
	},
	{
		name: 'typing: main process delay p95',
		read: (s) => s.typing.mainDelayP95Ms,
		tolerance: 0.25,
		floorMs: 15,
	},
	{
		name: 'typing: renderer task time',
		read: (s) => s.typing.taskMs,
		tolerance: 0.25,
		floorMs: 150,
	},
]

/** Nearest-rank percentile. */
export function percentile(values: number[], p: number) {
	if (!values.length) return 0
	const sorted = [...values].sort((a, b) => a - b)
	return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))]!
}

export const median = (values: number[]) => percentile(values, 0.5)

export interface Row {
	name: string
	base?: number
	head: number
	change?: number
	regressed: boolean
}

/**
 * A budget regresses only when the head median is slower than the base median by both the ratio and
 * the absolute floor, and every head round is slower than the base median. Shared CI runners are
 * noisy; a real regression shifts the whole distribution, one slow round does not.
 */
export function compare(samples: Sample[]): Row[] {
	const head = samples.filter((s) => s.build === 'head')
	const base = samples.filter((s) => s.build === 'base')
	return budgets.map((budget) => {
		const headValues = head.map(budget.read)
		const headMedian = median(headValues)
		if (!base.length) return { name: budget.name, head: headMedian, regressed: false }
		const baseMedian = median(base.map(budget.read))
		const slower = headMedian - baseMedian
		const regressed =
			slower > budget.floorMs &&
			headMedian > baseMedian * (1 + budget.tolerance) &&
			Math.min(...headValues) > baseMedian
		return {
			name: budget.name,
			base: baseMedian,
			head: headMedian,
			change: baseMedian ? slower / baseMedian : 0,
			regressed,
		}
	})
}

const ms = (value: number) => `${Math.round(value)} ms`

export function markdown(rows: Row[], rounds: number) {
	const compared = rows.some((row) => row.base !== undefined)
	const lines = [
		'## Performance on the heavy study',
		'',
		compared
			? `Median of ${rounds} alternating rounds per build on this runner. Regressions fail the check.`
			: `Median of ${rounds} rounds. No base build to compare against.`,
		'',
		compared ? '| Budget | Base | Head | Change | |' : '| Budget | Median |',
		compared ? '|---|---:|---:|---:|---|' : '|---|---:|',
	]
	for (const row of rows) {
		if (row.base === undefined) {
			lines.push(`| ${row.name} | ${ms(row.head)} |`)
			continue
		}
		const change = `${row.change! >= 0 ? '+' : ''}${Math.round(row.change! * 100)}%`
		lines.push(
			`| ${row.name} | ${ms(row.base)} | ${ms(row.head)} | ${change} | ${row.regressed ? 'slower' : 'ok'} |`,
		)
	}
	return lines.join('\n') + '\n'
}
