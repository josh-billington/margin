import { app } from 'electron'
import { join } from 'node:path'
import { BibleService } from './provider'

export function bibleDatabasePath(
	packaged: boolean,
	resourcesPath: string,
	appPath: string,
): string {
	return packaged
		? join(resourcesPath, 'resources/bible/margin-bible.sqlite')
		: join(appPath, 'resources/bible/margin-bible.sqlite')
}

let service: BibleService | undefined
export function getBibleService(): BibleService {
	if (!service) {
		service = new BibleService(
			bibleDatabasePath(app.isPackaged, process.resourcesPath, app.getAppPath()),
		)
		app.once('will-quit', () => {
			service?.close()
			service = undefined
		})
	}
	return service
}
