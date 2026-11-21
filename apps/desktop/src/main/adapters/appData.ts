import { AppDataStore as SharedAppDataStore } from '@margin/services/appData/store'
import { createFileStore } from './files'
import { clock } from './host'
export class AppDataStore extends SharedAppDataStore {
	constructor(readonly path: string) {
		super({
			files: createFileStore({ root: path }),
			clock,
			setupComplete: process.env.MARGIN_LIBRARY_DIR !== undefined,
		})
	}
}
