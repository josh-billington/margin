import { afterEach, describe, expect, it, vi } from 'vitest'
import { Autosave } from './autosave'
afterEach(() => vi.useRealTimers())
describe('autosave', () => {
	it('debounces edits for 500ms', async () => {
		vi.useFakeTimers()
		const save = vi.fn(async () => {})
		const autosave = new Autosave(save)
		autosave.schedule()
		await vi.advanceTimersByTimeAsync(400)
		autosave.schedule()
		await vi.advanceTimersByTimeAsync(499)
		expect(save).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(1)
		expect(save).toHaveBeenCalledTimes(1)
	})
	it('saves within two seconds of continuous changes', async () => {
		vi.useFakeTimers()
		const save = vi.fn(async () => {})
		const autosave = new Autosave(save)
		for (let i = 0; i < 5; i++) {
			autosave.schedule()
			await vi.advanceTimersByTimeAsync(400)
		}
		expect(save).toHaveBeenCalledTimes(1)
	})
	it('flushes pending edits immediately and waits for an in-flight write', async () => {
		let finish = () => {}
		const save = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve
				}),
		)
		const autosave = new Autosave(save)
		autosave.schedule()
		let flushed = false
		const pending = autosave.flush().then(() => {
			flushed = true
		})
		await Promise.resolve()
		await Promise.resolve()
		expect(flushed).toBe(false)
		finish()
		await pending
		expect(flushed).toBe(true)
		expect(save).toHaveBeenCalledTimes(1)
	})
	it('propagates disk failure on flush and permits a retry', async () => {
		const save = vi
			.fn()
			.mockRejectedValueOnce(new Error('Disk full'))
			.mockResolvedValueOnce(undefined)
		const autosave = new Autosave(save)
		autosave.schedule()
		await expect(autosave.flush()).rejects.toThrow('Disk full')
		autosave.schedule()
		await autosave.flush()
		expect(save).toHaveBeenCalledTimes(2)
	})
	it('does not fail later flushes because of an earlier failed write', async () => {
		const save = vi.fn().mockRejectedValueOnce(new Error('EACCES')).mockResolvedValue(undefined)
		const autosave = new Autosave(save)
		autosave.schedule()
		await expect(autosave.flush()).rejects.toThrow('EACCES')
		await expect(autosave.flush()).resolves.toBeUndefined()
	})
})
