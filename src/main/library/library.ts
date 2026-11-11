import { readFile, readdir, mkdir, rm } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { ulid } from 'ulid'
import { watch, type FSWatcher } from 'chokidar'
import { migrateStudy, type PersistedStudy } from '../../shared/study/migrations'
import { atomicWrite } from './atomic'
import { acquireLibraryLock, type LibraryLock, type LibraryLockOwner } from './lock'

import type { LibraryEvent } from '../../shared/ipc/contract'
export type { LibraryEvent } from '../../shared/ipc/contract'
const hash = (content: string) => createHash('sha256').update(content).digest('hex')
const absent = (error: unknown) =>
	error instanceof Error && 'code' in error && error.code === 'ENOENT'
/** Recovery snapshots are throttled per study; each save inside this window skips its snapshot. */
const RECOVERY_INTERVAL_MS = 5 * 60 * 1000
export class Library {
	readOnly = true
	/** Set when another owner holds the lock; the renderer shows who and since when. */
	lockOwner: LibraryLockOwner | null = null
	private lock: LibraryLock | null = null
	private release = async () => {}
	private recovered = new Map<string, number>()
	private watcher?: FSWatcher
	private baselines = new Map<string, Set<string>>()
	private known = new Map<string, { study: PersistedStudy; hash: string }>()
	private staged = new Map<string, { study: PersistedStudy; sequence: number }>()
	private committed = new Map<string, number>()
	private sequences = new Map<string, number>()
	private queues = new Map<string, Promise<unknown>>()
	onEvent: (event: LibraryEvent) => void = () => {}
	constructor(
		readonly path: string,
		readonly appData: string,
		private write = atomicWrite,
	) {}
	file(id: string) {
		return join(this.path, 'studies', `${id}.study.json`)
	}
	async initialize(watching = true) {
		await mkdir(join(this.path, 'studies'), { recursive: true })
		const lock = await acquireLibraryLock(this.path)
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
			this.watcher = watch(join(this.path, 'studies'), {
				ignoreInitial: true,
				awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 30 },
			})
			this.watcher.on('all', (_event, path) => {
				const id = basename(path).match(/^([0-9A-HJKMNP-TV-Z]{26})\.study\.json$/)?.[1]
				if (id)
					void this.externalChange(id).catch((error) =>
						this.onEvent({ kind: 'error', studyId: id, message: String(error) }),
					)
			})
		}
		return this
	}
	private writable() {
		if (this.readOnly)
			throw new Error('This library is open read-only because another process holds its lock.')
	}
	/** Replaces a lock held by another host. Same-host owners are refused, so a live writer is never displaced. */
	async takeOver() {
		if (!this.readOnly || !this.lock)
			throw new Error('This library is not locked by another computer.')
		const release = await this.lock.takeOver()
		if (!release) throw new Error('This library is not locked by another computer.')
		this.release = release
		this.readOnly = false
		this.lockOwner = null
		await this.refreshIndex()
		return this
	}
	async list() {
		const studies: PersistedStudy[] = []
		for (const filename of await readdir(join(this.path, 'studies'))) {
			if (!filename.endsWith('.study.json')) continue
			try {
				const study = migrateStudy(
					JSON.parse(await readFile(join(this.path, 'studies', filename), 'utf8')),
				)
				if (filename !== `${study.id}.study.json`)
					throw new Error('Study filename does not match its ID.')
				studies.push(study)
			} catch (error) {
				this.onEvent({
					kind: 'error',
					studyId: filename.replace('.study.json', ''),
					message: String(error),
				})
			}
		}
		studies.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
		const index = JSON.stringify(
			studies.map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt })),
		)
		if (
			!this.readOnly &&
			(await readFile(join(this.path, 'library.json'), 'utf8').catch(() => '')) !== index
		)
			await this.write(join(this.path, 'library.json'), index)
		return studies.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
	}
	private async read(id: string) {
		const content = await readFile(this.file(id), 'utf8')
		const study = migrateStudy(JSON.parse(content))
		if (study.id !== id) throw new Error('Study filename does not match its ID.')
		return { study, hash: hash(content) }
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
		const now = new Date().toISOString()
		const study = migrateStudy({
			format: 'margin-study',
			schemaVersion: 1,
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
			if (!known) throw new Error('Open the study before saving it.')
			if (
				sequence <= (this.committed.get(study.id) ?? -1) ||
				sequence < (this.sequences.get(study.id) ?? -1)
			)
				return { study: known.study, conflict: false }
			const disk = await this.read(study.id).catch((error) => {
				if (absent(error))
					throw new Error('The study was deleted externally. Save a copy or close it.')
				throw error
			})
			if (
				disk.hash !== known.hash ||
				disk.study.revision !== known.study.revision ||
				(base !== undefined && !this.baselines.get(study.id)?.has(hash(base)))
			)
				return this.conflict(study, disk)
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
				updatedAt: new Date().toISOString(),
			}
			await this.recoverThrottled(known.study)
			await this.persist(saved)
			this.committed.set(study.id, sequence)
			if (this.staged.get(study.id)?.sequence === sequence) this.staged.delete(study.id)
			await this.refreshIndex()
			return { study: saved, conflict: false }
		})
	}
	private acceptExternal(id: string, disk: { study: PersistedStudy; hash: string }) {
		this.known.set(id, disk)
		this.baselines.set(id, new Set([hash(JSON.stringify(disk.study))]))
	}
	private async refreshIndex() {
		try {
			await this.list()
		} catch (error) {
			// The authoritative study already reached disk; an index failure cannot undo that save.
			this.onEvent({ kind: 'error', studyId: '', message: `Library index: ${String(error)}` })
		}
		this.onEvent({ kind: 'list' })
	}

	private async persist(study: PersistedStudy) {
		const content = JSON.stringify(study)
		await this.write(this.file(study.id), content)
		this.known.set(study.id, { study, hash: hash(content) })
		const baselines = this.baselines.get(study.id) ?? new Set<string>()
		baselines.add(hash(content))
		this.baselines.set(study.id, baselines)
	}
	private async conflict(local: PersistedStudy, external: Awaited<ReturnType<Library['read']>>) {
		const staged = this.staged.get(local.id)
		const captured = staged?.study ?? local
		const copiedSequence = staged?.sequence ?? -1
		const copy = await this.create(`${captured.title} (conflict copy)`, captured.document)
		const known = this.known.get(local.id)
		if (known) await this.recover(known.study)
		this.acceptExternal(local.id, external)
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
				if (staged && known) await this.conflict(staged.study, disk)
				else if (known) {
					await this.recover(known.study)
					this.acceptExternal(id, disk)
					this.onEvent({ kind: 'reload', study: disk.study })
				}
			} catch (error) {
				if (absent(error)) this.onEvent({ kind: 'deleted', studyId: id })
				else this.onEvent({ kind: 'error', studyId: id, message: String(error) })
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
			await rm(this.file(id))
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
		if (last !== undefined && Date.now() - last < RECOVERY_INTERVAL_MS) return
		await this.recover(study)
	}
	private async recover(study: PersistedStudy) {
		const folder = join(this.appData, 'recovery', study.id)
		await this.write(
			join(
				folder,
				`${String(study.revision).padStart(16, '0')}-${hash(JSON.stringify(study))}.json`,
			),
			JSON.stringify(study),
		)
		this.recovered.set(study.id, Date.now())
		const versions = (await readdir(folder))
			.filter((name) => name.endsWith('.json'))
			.sort()
			.reverse()
		await Promise.all(versions.slice(20).map((name) => rm(join(folder, name))))
	}
	async latestRecovery(id: string) {
		const folder = join(this.appData, 'recovery', id)
		const names = await readdir(folder).catch(() => [])
		const versions: PersistedStudy[] = []
		for (const name of names) {
			try {
				versions.push(migrateStudy(JSON.parse(await readFile(join(folder, name), 'utf8'))))
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
	abandon(id: string) {
		this.staged.delete(id)
		this.known.delete(id)
		this.baselines.delete(id)
	}
	async flush() {
		while (this.queues.size) await Promise.all([...this.queues.values()])
		if (this.staged.size) throw new Error('Unsaved document changes remain. Retry or save a copy.')
	}
	async close() {
		try {
			await this.watcher?.close()
			await this.flush()
		} finally {
			await this.release()
		}
	}
}
