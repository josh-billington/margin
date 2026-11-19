import { acquireLibraryLock as acquire } from '@margin/services/library/lock'
import { createFileStore } from './files'
import { host, clock } from './host'
export type { LibraryLock, LibraryLockOwner } from '@margin/services/library/lock'
export const acquireLibraryLock = (path: string) =>
	acquire({ files: createFileStore({ root: path }), host, clock, scope: path })
