export class Autosave {
	private debounce?: ReturnType<typeof setTimeout>
	private maximum?: ReturnType<typeof setTimeout>
	private pending = false
	private running: Promise<void> = Promise.resolve()
	constructor(
		private save: () => Promise<void>,
		private debounceMs = 500,
		private maximumMs = 2000,
	) {}
	schedule() {
		this.pending = true
		clearTimeout(this.debounce)
		this.debounce = setTimeout(() => {
			void this.flush().catch(() => {})
		}, this.debounceMs)
		this.maximum ??= setTimeout(() => {
			void this.flush().catch(() => {})
		}, this.maximumMs)
	}
	cancel() {
		clearTimeout(this.debounce)
		clearTimeout(this.maximum)
		this.debounce = undefined
		this.maximum = undefined
		this.pending = false
	}
	async flush() {
		clearTimeout(this.debounce)
		clearTimeout(this.maximum)
		this.debounce = undefined
		this.maximum = undefined
		if (this.pending) {
			this.pending = false
			this.running = this.running.catch(() => {}).then(this.save)
		} else {
			// An earlier failed run (since retried or superseded elsewhere) must not fail every later flush;
			// the session's save state, not this stale promise, says whether anything is unsaved.
			await this.running.catch(() => {})
			return
		}
		await this.running
		if (this.pending) await this.flush()
	}
}
