import { ulid } from 'ulid'
import {
	documentVersion,
	migrateStudy,
	type PersistedStudy,
} from '@margin/contract/study/migrations'
import type { FileStore, FileWatch, HostIdentity, Clock, Hasher, Diagnostics } from '../ports'
import { FileError } from '../ports'
import { join } from '../path'
import { acquireLibraryLock, type LibraryLock, type LibraryLockOwner } from './lock'
import { UserFacingError, userMessage } from '@margin/contract/errors'

import type { LibraryEvent } from '@margin/contract/ipc/contract'
export type { LibraryEvent } from '@margin/contract/ipc/contract'
const absent = (error: unknown) => error instanceof FileError && error.kind === 'missing'
/** Recovery snapshots are throttled per study; each save inside this window skips its snapshot. */
const RECOVERY_INTERVAL_MS = 5 * 60 * 1000
class ChangedBeforeReplace extends Error {}
export class Library {
	readOnly = true
	/** Set when another owner holds the lock; the renderer shows who and since when. */
	lockOwner: LibraryLockOwner | null = null
	private lock: LibraryLock | null = null
	private release = async () => {}
	private recovered = new Map<string, number>()
	private watcher?: ReturnType<FileWatch['watch']>
	private baselines = new Map<string, Set<string>>()
	private known = new Map<string, { study: PersistedStudy; hash: string }>()
	private staged = new Map<string, { study: PersistedStudy; sequence: number }>()
	private committed = new Map<string, number>()
	private sequences = new Map<string, number>()
	private queues = new Map<string, Promise<unknown>>()
	onEvent: (event: LibraryEvent) => void = () => {}
	constructor(
		private readonly ports: {
			files: FileStore
			appData: FileStore
			watch: FileWatch
			host: HostIdentity
			clock: Clock
			hasher: Hasher
			diagnostics: Diagnostics
			path: string
		},
	) {}
	get path() {
		return this.ports.path
	}
	private studyPath(id: string) {
		return join('studies', `${id}.study.json`)
	}
	private hash(content: string) {
		return this.ports.hasher.sha256Hex(content)
	}
	private write(path: string, content: string, beforeReplace?: () => Promise<void>) {
		return this.ports.files.writeAtomic({ path, content, beforeReplace })
	}

	async initialize(watching = true) {
		await this.ports.files.makeDir('studies')
		const lock = await acquireLibraryLock({
			files: this.ports.files,
			host: this.ports.host,
			clock: this.ports.clock,
			scope: this.path,
		})
		this.lock = lock
		this.readOnly = lock.readOnly
		this.lockOwner = lock.owner
		this.release = lock.release
		try {
			await this.list()
		} catch (error) {
			await this.release()
			throw error
		}
		if (watching) {
			this.watcherClosed = false
			this.startWatcher()
		}
		return this
	}
	private watcherClosed = false
	private startWatcher(retry = true) {
		this.watcher = this.ports.watch.watch({
			dir: 'studies',
			onChange: (name) => {
				const id = name.match(/^([0-9A-HJKMNP-TV-Z]{26})\.study\.json$/)?.[1]
				if (id)
					void this.externalChange(id).catch((error) =>
						this.onEvent({
							kind: 'error',
							studyId: id,
							message: userMessage(
								error,
								'Margin couldn’t reload this study. Save a copy or close the study and try opening it again.',
							),
						}),
					)
			},
			onError: (error) => {
				this.ports.diagnostics.failure('library-watcher-failed', error)
				this.onEvent({
					kind: 'error',
					studyId: '',
					message: retry
						? 'Margin couldn’t watch the library for changes. Trying again. Your unsaved studies are still open.'
						: 'Margin couldn’t watch the library for changes. Restart Margin to try again. Your unsaved studies are still open.',
				})
				if (!retry) return
				retry = false
				void this.watcher
					?.close()
					.then(() => {
						if (!this.watcherClosed) this.startWatcher(false)
					})
					.catch((error) => this.ports.diagnostics.failure('library-watcher-restart-failed', error))
			},
		})
	}

	private writable() {
		if (this.readOnly)
			throw new UserFacingError(
				'Another copy of Margin has this library open. Close it to save changes here.',
			)
	}
	/** Replaces a lock held by another host. Same-host owners are refused, so a live writer is never displaced. */
	async takeOver() {
		if (!this.readOnly || !this.lock)
			throw new UserFacingError(
				'No other computer has this library open. Try opening the library again.',
			)
		const release = await this.lock.takeOver()
		if (!release)
			throw new UserFacingError(
				'No other computer has this library open. Try opening the library again.',
			)
		this.release = release
		this.readOnly = false
		this.lockOwner = null
		await this.refreshIndex()
		return this
	}
	async list() {
		const studies: PersistedStudy[] = []
		for (const filename of await this.ports.files.list('studies')) {
			if (!filename.endsWith('.study.json')) continue
			try {
				const id = filename.replace('.study.json', '')
				const { study } = this.parse(id, await this.ports.files.read(join('studies', filename)))
				if (filename !== `${study.id}.study.json`)
					throw new UserFacingError(
						'Margin couldn’t open this study because its filename has changed. Restore its original filename and try again.',
					)
				studies.push(study)
			} catch (error) {
				this.onEvent({
					kind: 'error',
					studyId: filename.replace('.study.json', ''),
					message: userMessage(
						error,
						'Margin couldn’t read this study file. Restore a backup or open another study.',
					),
				})
			}
		}
		studies.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
		const index = JSON.stringify(
			studies.map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt })),
		)
		if (!this.readOnly && (await this.ports.files.read('library.json').catch(() => '')) !== index)
			await this.write('library.json', index)
		return studies.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
	}
	private async read(id: string) {
		const content = await this.ports.files.read(this.studyPath(id))
		return this.parse(id, content)
	}
	private parse(id: string, content: string) {
		const digest = this.hash(content)
		const cached = this.known.get(id)
		if (cached?.hash === digest) return cached
		const study = migrateStudy(JSON.parse(content))
		if (study.id !== id)
			throw new UserFacingError(
				'Margin couldn’t open this study because its filename has changed. Restore its original filename and try again.',
			)
		return { study, hash: digest }
	}
	async open(id: string) {
		const disk = await this.read(id).catch(async (error: unknown) => {
			const recovery = await this.latestRecovery(id)
			if (recovery) this.onEvent({ kind: 'recovery', study: recovery })
			throw error
		})
		this.acceptExternal(id, disk)
		// The first save after opening always snapshots the file it replaces.
		this.recovered.delete(id)
		this.sequences.delete(id)
		this.staged.delete(id)
		this.committed.set(id, this.sequences.get(id) ?? -1)
		const recovery = await this.latestRecovery(id)
		if (
			recovery &&
			(recovery.revision > disk.study.revision || recovery.updatedAt > disk.study.updatedAt)
		)
			this.onEvent({ kind: 'recovery', study: recovery })
		return disk.study
	}
	async create(title: string, document: PersistedStudy['document']) {
		this.writable()
		const now = new Date(this.ports.clock.now()).toISOString()
		const study = migrateStudy({
			format: 'margin-study',
			schemaVersion: documentVersion(document),
			id: ulid(),
			title,
			createdAt: now,
			updatedAt: now,
			revision: 0,
			document,
		})
		await this.persist(study)
		await this.refreshIndex()
		return study
	}
	stage(study: PersistedStudy, sequence: number) {
		if (sequence <= (this.committed.get(study.id) ?? -1)) return
		if (sequence <= (this.sequences.get(study.id) ?? -1)) return
		this.sequences.set(study.id, sequence)
		this.staged.set(study.id, { study, sequence })
	}
	private enqueue<T>(id: string, action: () => Promise<T>): Promise<T> {
		const next = (this.queues.get(id) ?? Promise.resolve()).catch(() => {}).then(action)
		this.queues.set(id, next)
		void next
			.finally(() => {
				if (this.queues.get(id) === next) this.queues.delete(id)
			})
			.catch(() => {})
		return next
	}
	save(study: PersistedStudy, sequence: number, base?: string) {
		this.stage(study, sequence)
		return this.enqueue(study.id, async () => {
			this.writable()
			const known = this.known.get(study.id)
			if (!known)
				throw new UserFacingError(
					'Margin couldn’t save this study because it isn’t open. Open the study and try again.',
				)
			if (
				sequence <= (this.committed.get(study.id) ?? -1) ||
				sequence < (this.sequences.get(study.id) ?? -1)
			)
				return { study: known.study, conflict: false }
			const disk = await this.read(study.id).catch((error) => {
				if (absent(error))
					throw new UserFacingError(
						'Margin can no longer find this study’s file. Save a copy or close the study.',
					)
				throw error
			})
			if (
				disk.hash !== known.hash ||
				disk.study.revision !== known.study.revision ||
				(base !== undefined && !this.baselines.get(study.id)?.has(this.hash(base)))
			)
				return this.conflict(study)
			if (
				JSON.stringify(study.document) === JSON.stringify(known.study.document) &&
				study.title === known.study.title
			) {
				this.staged.delete(study.id)
				this.committed.set(study.id, sequence)
				return { study: known.study, conflict: false }
			}
			const saved = {
				...study,
				revision: known.study.revision + 1,
				updatedAt: new Date(this.ports.clock.now()).toISOString(),
			}
			await this.recoverThrottled(known.study)
			try {
				await this.persist(saved, async () => {
					if ((await this.read(study.id)).hash !== disk.hash) throw new ChangedBeforeReplace()
				})
			} catch (error) {
				if (error instanceof ChangedBeforeReplace) return this.conflict(study)
				throw error
			}
			this.committed.set(study.id, sequence)
			if (this.staged.get(study.id)?.sequence === sequence) this.staged.delete(study.id)
			await this.refreshIndex()
			return { study: saved, conflict: false }
		})
	}
	private acceptExternal(id: string, disk: { study: PersistedStudy; hash: string }) {
		this.known.set(id, disk)
		this.baselines.set(id, new Set([this.hash(JSON.stringify(disk.study))]))
	}
	private async refreshIndex() {
		try {
			await this.list()
		} catch {
			// The authoritative study already reached disk; an index failure cannot undo that save.
			this.onEvent({
				kind: 'error',
				studyId: '',
				message:
					'Margin couldn’t update the study list. Check that you can open the library folder and try again.',
			})
		}
		this.onEvent({ kind: 'list' })
	}

	private async persist(study: PersistedStudy, beforeReplace?: () => Promise<void>) {
		const content = JSON.stringify(study)
		await this.write(this.studyPath(study.id), content, beforeReplace)
		const digest = this.hash(content)
		this.known.set(study.id, { study, hash: digest })
		const baselines = this.baselines.get(study.id) ?? new Set<string>()
		baselines.add(digest)
		this.baselines.set(study.id, baselines)
	}
	private async conflict(local: PersistedStudy) {
		const staged = this.staged.get(local.id)
		const captured = staged?.study ?? local
		const copiedSequence = staged?.sequence ?? -1
		const copy = await this.create(`${captured.title} (conflict copy)`, captured.document)
		const known = this.known.get(local.id)
		if (known) await this.recover(known.study)
		this.acceptExternal(local.id, await this.read(local.id))
		this.committed.set(local.id, copiedSequence)
		if ((this.staged.get(local.id)?.sequence ?? -1) <= copiedSequence) this.staged.delete(local.id)
		this.onEvent({ kind: 'conflict', study: copy, originalId: local.id })
		return { study: copy, conflict: true }
	}
	async externalChange(id: string) {
		return this.enqueue(id, async () => {
			const known = this.known.get(id)
			try {
				const disk = await this.read(id)
				if (known?.hash === disk.hash && known.study.revision === disk.study.revision) return
				const staged = this.staged.get(id)
				if (staged && known) await this.conflict(staged.study)
				else if (known) {
					await this.recover(known.study)
					this.acceptExternal(id, disk)
					this.onEvent({ kind: 'reload', study: disk.study })
				}
			} catch (error) {
				if (absent(error)) this.onEvent({ kind: 'deleted', studyId: id })
				else
					this.onEvent({
						kind: 'error',
						studyId: id,
						message: userMessage(
							error,
							'Margin couldn’t reload this study. Save a copy or close the study and try opening it again.',
						),
					})
			}
			await this.list()
			this.onEvent({ kind: 'list' })
		})
	}
	async delete(id: string) {
		return this.enqueue(id, async () => {
			this.writable()
			const disk = await this.read(id)
			await this.recover(disk.study)
			await this.ports.files.remove(this.studyPath(id))
			this.known.delete(id)
			this.baselines.delete(id)
			this.staged.delete(id)
			await this.list()
			this.onEvent({ kind: 'list' })
		})
	}
	/** Snapshots at most once per RECOVERY_INTERVAL_MS per study. Conflicts, reloads, and deletes always snapshot. */
	private async recoverThrottled(study: PersistedStudy) {
		const last = this.recovered.get(study.id)
		if (last !== undefined && this.ports.clock.now() - last < RECOVERY_INTERVAL_MS) return
		await this.recover(study)
	}
	private async recover(study: PersistedStudy) {
		const folder = join('recovery', study.id)
		const content = JSON.stringify(study)
		await this.ports.appData.writeAtomic({
			path: join(folder, `${String(study.revision).padStart(16, '0')}-${this.hash(content)}.json`),
			content,
		})
		this.recovered.set(study.id, this.ports.clock.now())
		const versions = (await this.ports.appData.list(folder))
			.filter((name) => name.endsWith('.json'))
			.sort()
			.reverse()
		await Promise.all(
			versions.slice(20).map((name) => this.ports.appData.remove(join(folder, name))),
		)
	}
	async latestRecovery(id: string) {
		const folder = join('recovery', id)
		const names = await this.ports.appData.list(folder).catch(() => [])
		const versions: PersistedStudy[] = []
		for (const name of names) {
			try {
				versions.push(migrateStudy(JSON.parse(await this.ports.appData.read(join(folder, name)))))
			} catch {
				/* A corrupt recovery must not hide a valid version. */
			}
		}
		return (
			versions
				.filter((study) => study.id === id)
				.sort((a, b) => b.revision - a.revision || b.updatedAt.localeCompare(a.updatedAt))[0] ??
			null
		)
	}
	stagedIds() {
		return this.staged.keys()
	}
	hasSnapshot(id: string, sequence: number) {
		return this.staged.get(id)?.sequence === sequence || this.committed.get(id) === sequence
	}
	closeStudy(id: string) {
		return this.enqueue(id, async () => this.abandon(id))
	}
	abandon(id: string) {
		this.staged.delete(id)
		this.known.delete(id)
		this.baselines.delete(id)
	}
	/**
	 * Writes every unsaved change to the app-data recovery folder, newer than the file on disk,
	 * so the next open offers it. Used when the user quits while the study folder can't be written.
	 */
	async preserveUnsaved() {
		const preserved: string[] = []
		const failed: { id: string; title: string }[] = []
		for (const { study } of this.staged.values()) {
			const base = this.known.get(study.id)?.study.revision ?? study.revision
			try {
				await this.recover({
					...study,
					revision: base + 1,
					updatedAt: new Date(this.ports.clock.now()).toISOString(),
				})
				preserved.push(study.id)
			} catch {
				failed.push({ id: study.id, title: study.title })
			}
		}
		return { preserved, failed }
	}
	async flush() {
		while (this.queues.size) await Promise.all([...this.queues.values()])
		if (this.staged.size)
			throw new UserFacingError(
				'Margin couldn’t save your changes. Try again or save a copy before closing or switching studies.',
			)
	}
	async close() {
		this.watcherClosed = true
		try {
			await this.watcher?.close()
			await this.flush()
		} finally {
			await this.release()
		}
	}
}
