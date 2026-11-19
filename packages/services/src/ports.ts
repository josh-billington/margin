import { z } from 'zod'
import type { LibraryEvent, LibraryFolder } from '@margin/contract/ipc/contract'

export interface Database {
	get(sql: string, params?: readonly unknown[]): Promise<unknown>
	all(sql: string, params?: readonly unknown[]): Promise<readonly unknown[]>
	userVersion(): Promise<number>
	close(): Promise<void>
}
export type Corpus = 'bible' | 'lexicon'
export type OpenDatabase = (corpus: Corpus) => Promise<Database>
export type FileErrorKind = 'missing' | 'exists' | 'denied' | 'readOnly' | 'full'
export class FileError extends Error {
	constructor(
		readonly kind: FileErrorKind,
		readonly path: string,
		options?: ErrorOptions,
	) {
		super(`${kind}: ${path}`, options)
	}
}
/** Paths are posix-style and relative to the store's host-chosen root. */
export interface FileStore {
	read(path: string): Promise<string>
	list(dir: string): Promise<readonly string[]>
	writeAtomic(args: {
		path: string
		content: string
		beforeReplace?: () => Promise<void>
	}): Promise<void>
	createExclusive(args: { path: string; content: string }): Promise<boolean>
	remove(path: string): Promise<void>
	makeDir(path: string): Promise<void>
	modifiedAt(path: string): Promise<number>
}
export interface FileWatch {
	watch(args: {
		dir: string
		onChange: (name: string) => void
		onError: (error: unknown) => void
	}): { close(): Promise<void> }
}
export const lockOwnerSchema = z.object({
	pid: z.number().int().positive(),
	hostname: z.string(),
	acquiredAt: z.string().optional(),
})
export type LibraryLockOwner = z.infer<typeof lockOwnerSchema>
export interface HostIdentity {
	current(): LibraryLockOwner
	isAlive(owner: LibraryLockOwner): boolean
}
export interface Clock {
	now(): number
}
export interface Hasher {
	sha256Hex(data: string | Uint8Array): string
}
export interface Codec {
	inflateRaw(data: Uint8Array): Uint8Array
}
export interface HostUi {
	pickFolder(current: string): Promise<string | null>
	confirmDiscard(args: { message: string; detail: string }): Promise<'keep' | 'discard'>
	requestRendererFlush(): Promise<boolean>
	emit(event: LibraryEvent): void
	describeFolder(path: string): LibraryFolder
}
export interface Ports {
	openDatabase: OpenDatabase
	library: FileStore
	appData: FileStore
	watch: FileWatch
	host: HostIdentity
	clock: Clock
	hasher: Hasher
	codec: Codec
	ui: HostUi
}
