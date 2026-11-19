import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { Preferences } from '@shared/ipc/contract'
import { createServices } from '@margin/services/services'
import { errorMessage as sharedErrorMessage } from '@margin/services/persistence'
import { hasher, codec } from '../adapters/host'
import { openDatabase } from '../adapters/database'
import { createFileStore, createFileWatch, fileError } from '../adapters/files'
import { host, clock, diagnostics } from '../adapters/host'
import { createHostUi, installCloseEvents } from '../adapters/ui'
import { registerServiceHandlers } from './boundary'
import { logFailure } from '../logger'

export { describeFolder } from '../adapters/ui'
export const errorMessage = (error: unknown, fallback?: string) =>
	sharedErrorMessage(fileError(error, ''), fallback)

export async function registerPersistence(
	getWindow: () => BrowserWindow | null,
	onAppearanceChange: (preferences: Preferences) => void = () => {},
) {
	const services = await createServices({
		openDatabase: async (corpus) =>
			openDatabase(
				join(
					app.isPackaged
						? join(process.resourcesPath, 'resources')
						: join(app.getAppPath(), 'resources'),
					corpus,
					`margin-${corpus}.sqlite`,
				),
			),
		library: (path) => ({ files: createFileStore({ root: path }), watch: createFileWatch(path) }),
		appData: createFileStore({ root: app.getPath('userData') }),
		host,
		clock,
		diagnostics,
		hasher,
		codec,
		ui: createHostUi({ getWindow, onAppearanceChange }),
		configuration: {
			defaultLibraryPath:
				process.env.MARGIN_DEFAULT_LIBRARY_DIR ?? join(app.getPath('documents'), 'Margin'),
			libraryPathOverride: process.env.MARGIN_LIBRARY_DIR,
			setupComplete: process.env.MARGIN_LIBRARY_DIR !== undefined,
		},
	})
	registerServiceHandlers({ getWindow, handlers: services.handlers })
	installCloseEvents({
		getWindow,
		requestClose: services.requestClose,
		close: () => services.close().catch((error) => logFailure('library-close-failed', error)),
	})
	return services.data
}
