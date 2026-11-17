import { describe, expect, it } from 'vitest'
import { nextShown, SAVE_TIMING } from './SaveIndicator'
import type { SaveState, ShownSaveState } from './SaveIndicator'

/** Replays real save states at the given times and records every label the title bar showed. */
function replay(events: [atMs: number, state: SaveState][], untilMs: number) {
	let shown: ShownSaveState = 'saved'
	let pending: { show: ShownSaveState; at: number } | null = null
	const seen: [number, ShownSaveState][] = []
	const show = (at: number, next: ShownSaveState) => {
		if (next !== shown) seen.push([at, next])
		shown = next
	}
	for (const [at, state] of [...events, [untilMs, null] as const]) {
		if (pending && pending.at <= at) show(pending.at, pending.show)
		pending = null
		if (state === null) break
		const next = nextShown(state, shown)
		show(at, next.show)
		if (next.later) pending = { show: next.later.show, at: at + next.later.afterMs }
	}
	return seen
}

/** Autosave while typing: every keystroke marks unsaved; a 30ms save runs every 2s (the cap). */
function typing(forMs: number, saveMs = 30): [number, SaveState][] {
	const events: [number, SaveState][] = []
	for (let t = 0; t < forMs; t += 150) events.push([t, 'unsaved'])
	for (let t = 2000; t < forMs + 500; t += 2000) events.push([t, 'saving'], [t + saveMs, 'saved'])
	return events.sort((a, b) => a[0] - b[0])
}

describe('save indicator', () => {
	it('stays quiet while typing and says "Saved" once, after the last save', () => {
		const seen = replay(typing(10_000), 15_000)
		expect(seen.map(([, label]) => label)).toEqual(['quiet', 'saved'])
	})

	it('never says "Saved" while the study is not on disk', () => {
		for (const state of ['unsaved', 'saving', 'error'] as const)
			for (const now of ['saved', 'quiet', 'saving', 'unsaved', 'error'] as const) {
				const next = nextShown(state, now)
				expect(next.show).not.toBe('saved')
				expect(next.later?.show).not.toBe('saved')
			}
	})

	it('mentions a slow save, and unsaved changes autosave has not picked up', () => {
		expect(replay([[0, 'saving']], 5000)).toEqual([
			[0, 'quiet'],
			[SAVE_TIMING.savingAfterMs, 'saving'],
		])
		expect(replay([[0, 'unsaved']], 10_000)).toEqual([
			[0, 'quiet'],
			[SAVE_TIMING.unsavedAfterMs, 'unsaved'],
		])
	})

	it('shows errors at once and confirms the retry that fixes them', () => {
		expect(
			replay(
				[
					[0, 'error'],
					[1000, 'saving'],
					[1100, 'saved'],
				],
				3000,
			),
		).toEqual([
			[0, 'error'],
			[1000, 'saving'],
			[1100, 'saved'],
		])
	})
})
