import { contextBridge, ipcRenderer } from 'electron'
import type { z } from 'zod'
import {
	APPEARANCE_ARGUMENT,
	APPEARANCE_CHANNEL,
	resolvedAppearanceSchema,
	GLASS_ARGUMENT,
	GLASS_CHANNEL,
	glassModeSchema,
	ipcContract,
	libraryEventSchema,
} from '@shared/ipc/contract'
import { appCommandSchema, COMMAND_CHANNEL } from '@shared/ipc/commands'
import type { AppCommandId } from '@shared/ipc/commands'
import type { GlassMode, MarginApi, LibraryEvent, ResolvedAppearance } from '@shared/ipc/contract'

function bind<I extends z.ZodType, O extends z.ZodType>(operation: {
	channel: string
	request: I
	response: O
}) {
	return async (request: z.input<I>): Promise<z.output<O>> => {
		const payload = operation.request.parse(request)
		const response: unknown = await ipcRenderer.invoke(operation.channel, payload)
		return operation.response.parse(response)
	}
}

const initialGlass = glassModeSchema
	.catch('none')
	.parse(process.argv.find((arg) => arg.startsWith(GLASS_ARGUMENT))?.slice(GLASS_ARGUMENT.length))

const initialAppearance = resolvedAppearanceSchema
	.catch('dark')
	.parse(
		process.argv
			.find((arg) => arg.startsWith(APPEARANCE_ARGUMENT))
			?.slice(APPEARANCE_ARGUMENT.length),
	)

const api = {
	appearance: {
		mode: initialAppearance,
		onChange: (listener: (mode: ResolvedAppearance) => void) => {
			const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
				const parsed = resolvedAppearanceSchema.safeParse(payload)
				if (parsed.success) listener(parsed.data)
			}
			ipcRenderer.on(APPEARANCE_CHANNEL, handler)
			return () => {
				ipcRenderer.removeListener(APPEARANCE_CHANNEL, handler)
			}
		},
	},
	glass: {
		mode: initialGlass,
		onChange: (listener: (mode: GlassMode) => void) => {
			const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
				const parsed = glassModeSchema.safeParse(payload)
				if (parsed.success) listener(parsed.data)
			}
			ipcRenderer.on(GLASS_CHANNEL, handler)
			return () => {
				ipcRenderer.removeListener(GLASS_CHANNEL, handler)
			}
		},
	},
	library: {
		getLibrary: bind(ipcContract.library.getLibrary),
		chooseLibraryFolder: bind(ipcContract.library.chooseLibraryFolder),
		createStudy: bind(ipcContract.library.createStudy),
		listStudies: bind(ipcContract.library.listStudies),
		openStudy: bind(ipcContract.library.openStudy),
		saveStudy: bind(ipcContract.library.saveStudy),
		closeStudy: bind(ipcContract.library.closeStudy),
		stageStudy: bind(ipcContract.library.stageStudy),
		flush: bind(ipcContract.library.flush),
		takeOver: bind(ipcContract.library.takeOver),
		deleteStudy: bind(ipcContract.library.deleteStudy),
	},
	bible: {
		resolveReference: bind(ipcContract.bible.resolveReference),
		getPassage: bind(ipcContract.bible.getPassage),
		mapPassage: bind(ipcContract.bible.mapPassage),
		listTranslations: bind(ipcContract.bible.listTranslations),
	},
	lexicon: {
		copyEntry: bind(ipcContract.lexicon.copyEntry),
		lookupSelection: bind(ipcContract.lexicon.lookupSelection),
		getEntry: bind(ipcContract.lexicon.getEntry),
		contextMenu: bind(ipcContract.lexicon.contextMenu),
	},
	prefs: { get: bind(ipcContract.prefs.get), set: bind(ipcContract.prefs.set) },
	events: {
		onLibrary: (listener: (event: LibraryEvent) => void) => {
			const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
				const parsed = libraryEventSchema.safeParse(payload)
				if (parsed.success) listener(parsed.data)
			}
			ipcRenderer.on('margin:library:event', handler)
			return () => {
				ipcRenderer.removeListener('margin:library:event', handler)
			}
		},
		onCommand: (listener: (id: AppCommandId) => void) => {
			const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
				const parsed = appCommandSchema.safeParse(payload)
				if (parsed.success) listener(parsed.data)
			}
			ipcRenderer.on(COMMAND_CHANNEL, handler)
			return () => {
				ipcRenderer.removeListener(COMMAND_CHANNEL, handler)
			}
		},
		onFlush: (listener: () => Promise<boolean>) => {
			const handler = (_event: Electron.IpcRendererEvent, token: unknown) => {
				if (typeof token === 'string')
					void listener()
						.then((ok) => ipcRenderer.send('margin:library:flushed', { token, ok }))
						.catch(() => ipcRenderer.send('margin:library:flushed', { token, ok: false }))
			}
			ipcRenderer.on('margin:library:request-flush', handler)
			return () => {
				ipcRenderer.removeListener('margin:library:request-flush', handler)
			}
		},
	},
	camera: { get: bind(ipcContract.camera.get), set: bind(ipcContract.camera.set) },
} satisfies MarginApi

contextBridge.exposeInMainWorld('margin', api)
