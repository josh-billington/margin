import { z } from 'zod'
import { cameraSchema, preferencesSchema } from '@margin/contract/ipc/contract'
import type { FileStore, Clock } from '../ports'
import { FileError } from '../ports'

const settingsSchema = z.object({
	libraryPath: z.string().optional(),
	setup: z.enum(['pending', 'done']).default('done'),
	preferences: preferencesSchema.default({
		defaultTranslation: 'kjv',
		oldTestamentTranslation: 'kjv',
		defaultNoteFont: 'handwritten',
		displayNotesInPlainFont: false,
		introSeen: false,
	}),
	cameras: z.record(z.string(), cameraSchema).default({}),
})
export class AppDataStore {
	private data = settingsSchema.parse({})
	private queue = Promise.resolve()
	constructor(private readonly ports: { files: FileStore; clock: Clock; setupComplete: boolean }) {}
	async open() {
		try {
			this.data = settingsSchema.parse(JSON.parse(await this.ports.files.read('prefs.json')))
		} catch (error) {
			if (error instanceof SyntaxError || error instanceof z.ZodError) {
				await this.ports.files.move({
					from: 'prefs.json',
					to: `prefs.json.bad-${this.ports.clock.now()}`,
				})
			} else if (!(error instanceof FileError && error.kind === 'missing')) {
				throw error
			}
			this.data.setup = 'pending'
		}
		if (this.ports.setupComplete) this.data.setup = 'done'
		return this
	}
	get setup() {
		return this.data.setup
	}
	completeSetup() {
		return this.update((settings) => {
			settings.setup = 'done'
		})
	}
	get libraryPath() {
		return this.data.libraryPath
	}
	get preferences() {
		return this.data.preferences
	}
	camera(id: string) {
		return this.data.cameras[id] ?? null
	}
	update(change: (data: z.infer<typeof settingsSchema>) => void) {
		const next = this.queue
			.catch(() => {})
			.then(async () => {
				const data = structuredClone(this.data)
				change(data)
				await this.ports.files.writeAtomic({ path: 'prefs.json', content: JSON.stringify(data) })
				this.data = data
			})
		this.queue = next
		return next
	}
}
