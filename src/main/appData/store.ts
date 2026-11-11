import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { cameraSchema, preferencesSchema } from '../../shared/ipc/contract'
import { atomicWrite } from '../library/atomic'

const settingsSchema = z.object({
	libraryPath: z.string().optional(),
	setup: z.enum(['pending', 'done']).default('done'),
	preferences: preferencesSchema.default({
		defaultTranslation: 'kjv',
		oldTestamentTranslation: 'kjv',
		defaultNoteFont: 'handwritten',
		displayNotesInPlainFont: false,
	}),
	cameras: z.record(z.string(), cameraSchema).default({}),
})
export class AppDataStore {
	private data = settingsSchema.parse({})
	private queue = Promise.resolve()
	constructor(readonly path: string) {}
	async open() {
		try {
			this.data = settingsSchema.parse(
				JSON.parse(await readFile(join(this.path, 'prefs.json'), 'utf8')),
			)
		} catch (error) {
			if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
			this.data.setup = 'pending'
		}
		if (process.env.MARGIN_LIBRARY_DIR !== undefined) this.data.setup = 'done'
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
				await atomicWrite(join(this.path, 'prefs.json'), JSON.stringify(data))
				this.data = data
			})
		this.queue = next
		return next
	}
}
