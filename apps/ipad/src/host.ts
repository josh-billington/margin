import { App } from '@capacitor/app'
import { Clipboard } from '@capacitor/clipboard'
import { Directory } from '@capacitor/filesystem'
import { z } from 'zod'
import type {
	MarginApi,
	LibraryEvent,
	Preferences,
	ResolvedAppearance,
} from '@margin/contract/ipc/contract'
import { createServices } from '@margin/services/services'
import { createServiceApi } from '@margin/services/api'
import { codec, hasher } from '@margin/services/codecs'
import { FileError, lockOwnerSchema } from '@margin/services/ports'
import type { HostIdentity, FileWatch } from '@margin/services/ports'
import { createFileStore } from './files'
import { createOpenDatabase } from './database'
import { nativeFiles } from './nativeFiles'

function listeners<Listener>() {
	const values = new Set<Listener>()
	return {
		values,
		subscribe(listener: Listener) {
			values.add(listener)
			return () => {
				values.delete(listener)
			}
		},
	}
}

export async function installHost() {
	const appData = createFileStore({ directory: Directory.Library, root: 'Margin' })
	const library = createFileStore({ directory: Directory.Documents, root: 'Margin' })
	await appData.makeDir('')
	await library.makeDir('')
	let installId: string
	try {
		installId = z.uuid().parse(await appData.read('install-id'))
	} catch (error) {
		if (!(error instanceof FileError && error.kind === 'missing')) throw error
		installId = crypto.randomUUID()
		await appData.writeAtomic({ path: 'install-id', content: installId })
	}
	const owner = { hostname: `ipad:${installId}`, acquiredAt: new Date().toISOString() }
	const host: HostIdentity = {
		current: () => owner,
		isAlive: (candidate) => candidate.hostname === owner.hostname,
	}
	try {
		const previous = lockOwnerSchema.parse(JSON.parse(await library.read('.margin-lock')))
		if (host.isAlive(previous)) await library.remove('.margin-lock')
	} catch (error) {
		if (
			!(error instanceof FileError && error.kind === 'missing') &&
			!(error instanceof SyntaxError) &&
			!(error instanceof z.ZodError)
		)
			throw error
	}
	const libraryEvents = listeners<(event: LibraryEvent) => void>()
	const flushEvents = listeners<() => Promise<boolean>>()
	const commandEvents = listeners<Parameters<MarginApi['events']['onCommand']>[0]>()
	const appearanceEvents = listeners<(mode: ResolvedAppearance) => void>()
	const system = matchMedia('(prefers-color-scheme: dark)')
	let preference: Preferences['appearance'] = 'system'
	const appearance = (): ResolvedAppearance =>
		preference === 'dark' || (preference !== 'light' && system.matches) ? 'dark' : 'light'
	const publishAppearance = () => {
		for (const listener of appearanceEvents.values) listener(appearance())
	}
	const flush = async () => {
		try {
			const results = await Promise.all([...flushEvents.values].map((listener) => listener()))
			return results.every(Boolean)
		} catch {
			return false
		}
	}
	const watch: FileWatch = { watch: () => ({ close: async () => {} }) }
	const services = await createServices({
		openDatabase: createOpenDatabase(),
		appData,
		library: () => ({ files: library, watch }),
		host,
		clock: { now: () => Date.now() },
		hasher,
		codec,
		diagnostics: {
			event: () => {},
			failure: (name, error) => console.error('[margin-ipad]', name, error),
		},
		configuration: { defaultLibraryPath: 'Margin', setupComplete: true },
		ui: {
			pickFolder: async () => null,
			confirmDiscard: async () => 'keep',
			requestRendererFlush: flush,
			emit: (event) => {
				for (const listener of libraryEvents.values) listener(event)
			},
			describeFolder: () => ({ name: 'Margin', location: 'On My iPad' }),
			appearanceChanged: (prefs) => {
				preference = prefs.appearance
				publishAppearance()
			},
			copyText: (text) => {
				void Clipboard.write({ string: text }).catch((error: unknown) =>
					console.error('[margin-ipad]', 'clipboard-write-failed', error),
				)
			},
			showLookupMenu: async () => {},
		},
	})
	preference = services.data.preferences.appearance
	const api = {
		...createServiceApi({ handlers: services.handlers }),
		platform: { kind: 'ipad', nativeMenu: false, nativeContextMenu: false },
		appearance: { mode: appearance(), onChange: appearanceEvents.subscribe },
		glass: { mode: 'none', onChange: () => () => {} },
		menu: { setSidebarShown: () => {} },
		events: {
			onLibrary: libraryEvents.subscribe,
			onFlush: flushEvents.subscribe,
			onCommand: commandEvents.subscribe,
		},
	} satisfies MarginApi
	window.margin = api
	system.addEventListener('change', publishAppearance)
	await App.addListener('appStateChange', ({ isActive }) => {
		if (!isActive)
			void nativeFiles
				.beginBackgroundFlush()
				.then(flush)
				.then((ok) => {
					if (!ok) console.error('[margin-ipad]', 'background-flush-failed')
				})
				.finally(() => nativeFiles.finishBackgroundFlush())
				.catch((error: unknown) => console.error('[margin-ipad]', 'background-flush-failed', error))
	})
}
