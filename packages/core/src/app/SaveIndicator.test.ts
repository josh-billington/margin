import { describe, expect, it } from 'vitest'
import { nextShown, SAVE_TIMING, shownLabel } from './SaveIndicator'
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
	it('keeps "Saved" steady on screen while typing, through every ordinary autosave', () => {
		const seen = replay(typing(10_000), 15_000)
		expect(new Set(seen.map(([, shown]) => shownLabel(shown)))).toEqual(new Set(['Saved']))
		expect(seen.at(-1)?.[1]).toBe('saved')
	})

	it('only claims "Saved" anew once the study is on disk', () => {
		for (const state of ['unsaved', 'saving', 'error'] as const)
			for (const now of ['saved', 'quiet', 'saving', 'unsaved', 'error'] as const) {
				const next = nextShown(state, now)
				expect(next.show).not.toBe('saved')
				expect(next.later?.show).not.toBe('saved')
				// Ordinary autosave may keep the last "Saved" up, but never brings it back after a message.
				if (now !== 'saved' && now !== 'quiet') expect(next.show).not.toBe('quiet')
			}
	})

	it('goes from a message on screen to progress, then "Saved" when the save lands', () => {
		expect(
			replay(
				[
					[0, 'unsaved'],
					[5000, 'saving'],
					[5100, 'saved'],
				],
				6000,
			),
		).toEqual([
			[0, 'quiet'],
			[SAVE_TIMING.unsavedAfterMs, 'unsaved'],
			[5000, 'saving'],
			[5100, 'saved'],
		])
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

	it('turns an error into progress when Try again marks the study unsaved', () => {
		expect(
			replay(
				[
					[0, 'error'],
					[1000, 'unsaved'],
					[1001, 'saving'],
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
