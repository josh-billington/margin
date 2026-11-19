import { join } from 'node:path'
import { Library as SharedLibrary } from '@margin/services/library/library'
import { hasher } from '@margin/services/codecs'
import { createFileStore, createFileWatch } from './files'
import { host, clock, diagnostics } from './host'
import { atomicWrite } from './atomic'
export type { LibraryEvent } from '@margin/services/library/library'

export class Library extends SharedLibrary {
	constructor(path: string, appData: string, write = atomicWrite) {
		super({
			path,
			files: createFileStore({ root: path, write }),
			appData: createFileStore({ root: appData, write }),
			watch: createFileWatch(path),
			host,
			clock,
			hasher,
			diagnostics,
		})
	}
	file(id: string) {
		return join(this.path, 'studies', `${id}.study.json`)
	}
}
