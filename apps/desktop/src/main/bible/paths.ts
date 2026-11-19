import { app } from 'electron'
import { join } from 'node:path'
import { openBible, type BibleService } from '../adapters/bible'

export function bibleDatabasePath(
	packaged: boolean,
	resourcesPath: string,
	appPath: string,
): string {
	return packaged
		? join(resourcesPath, 'resources/bible/margin-bible.sqlite')
		: join(appPath, 'resources/bible/margin-bible.sqlite')
}

let service: Promise<BibleService> | undefined
export function getBibleService(): Promise<BibleService> {
	if (!service) {
		service = openBible(bibleDatabasePath(app.isPackaged, process.resourcesPath, app.getAppPath()))
		app.once('will-quit', () => {
			void service?.then((value) => value.close())
			service = undefined
		})
	}
	return service
}
