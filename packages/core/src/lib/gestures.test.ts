import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createLongPress } from './gestures'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const press = () => {
	const onLongPress = vi.fn()
	return { onLongPress, gesture: createLongPress({ delay: 500, slop: 10, onLongPress }) }
}
const at = { pointerId: 1, x: 100, y: 100 }
const tracked = () => {
	const events: string[] = []
	const gesture = createLongPress({
		delay: 500,
		slop: 10,
		onLongPress: () => events.push('fire'),
		onPressStart: () => events.push('start'),
		onPressEnd: () => events.push('end'),
	})
	return { events, gesture }
}

it('fires once the hold time passes, and swallows that release', () => {
	const { onLongPress, gesture } = press()
	gesture.down(at)
	gesture.move({ ...at, x: 106 })
	vi.advanceTimersByTime(499)
	expect(onLongPress).not.toHaveBeenCalled()
	vi.advanceTimersByTime(1)
	expect(onLongPress).toHaveBeenCalledWith(at)
	expect(gesture.up(1)).toBe(true)
})

it('cancels on movement past the slop, on an early release and on a second finger', () => {
	const { onLongPress, gesture } = press()
	gesture.down(at)
	gesture.move({ ...at, x: 111 })
	vi.advanceTimersByTime(600)
	gesture.down(at)
	expect(gesture.up(1)).toBe(false)
	vi.advanceTimersByTime(600)
	gesture.down(at)
	gesture.down({ ...at, pointerId: 2 })
	vi.advanceTimersByTime(600)
	expect(onLongPress).not.toHaveBeenCalled()
})

it('brackets each press, held or not, with one start and one end', () => {
	const { events, gesture } = tracked()
	gesture.down(at)
	gesture.up(1)
	gesture.down(at)
	gesture.move({ ...at, y: 120 })
	gesture.up(1)
	gesture.down(at)
	gesture.down({ ...at, pointerId: 2 })
	gesture.up(2)
	expect(events).toEqual(['start', 'end', 'start', 'end', 'start', 'end'])
})

it('keeps the press through the hold until the finger lifts or the touch is cancelled', () => {
	const { events, gesture } = tracked()
	gesture.down(at)
	vi.advanceTimersByTime(500)
	gesture.move({ ...at, x: 140 })
	expect(events).toEqual(['start', 'fire'])
	expect(gesture.up(1)).toBe(true)
	gesture.down(at)
	vi.advanceTimersByTime(500)
	gesture.cancel()
	gesture.up(1)
	expect(events).toEqual(['start', 'fire', 'end', 'start', 'fire', 'end'])
})
