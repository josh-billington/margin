import type { z } from 'zod'
import { ipcContract } from '@margin/contract/ipc/contract'
import { entryCitation, strongIdSchema } from '@margin/contract/lexicon/types'
import { bdbCitation } from '@margin/contract/lexicon/bdb'
import { BibleService, checkBibleStorage } from './bible/provider'
import { searchBible } from './bible/search'
import { LexiconService } from './lexicon/service'
import { Library } from './library/library'
import { AppDataStore } from './appData/store'
import { createPersistence } from './persistence'
import { validated } from './request'
import type { Database, Ports } from './ports'

type Contract = typeof ipcContract
type Operations = { [G in keyof Contract]: Contract[G][keyof Contract[G]] }[keyof Contract]
export type MarginHandlers = {
	[O in Operations as O['channel']]: (request?: unknown) => Promise<z.output<O['response']>>
}

export async function createServices(ports: Ports) {
	const data = new AppDataStore({
		files: ports.appData,
		clock: ports.clock,
		setupComplete: ports.configuration.setupComplete,
	})
	const persistence = await createPersistence({
		data,
		openLibrary: (path) => {
			const folder = ports.library(path)
			return new Library({
				path,
				files: folder.files,
				appData: ports.appData,
				watch: folder.watch,
				host: ports.host,
				clock: ports.clock,
				hasher: ports.hasher,
				diagnostics: ports.diagnostics,
			})
		},
		pathOverride: ports.configuration.libraryPathOverride,
		defaultPath: ports.configuration.defaultLibraryPath,
		host: ports.host,
		ui: ports.ui,
		diagnostics: ports.diagnostics,
	})
	let bible: Promise<BibleService> | undefined
	let bibleDb: Promise<Database> | undefined
	let lexicon: Promise<LexiconService> | undefined
	const getBibleDb = () =>
		(bibleDb ??= ports
			.openDatabase('bible')
			.then(async (db) => {
				try {
					await checkBibleStorage(db)
					return db
				} catch (error) {
					await db.close()
					throw error
				}
			})
			.catch((error) => {
				bibleDb = undefined
				throw error
			}))
	const getBible = () =>
		(bible ??= getBibleDb()
			.then(BibleService.loadInventory)
			.catch((error) => {
				bible = undefined
				throw error
			}))
	const getLexicon = () =>
		(lexicon ??= ports
			.openDatabase('lexicon')
			.then((db) => LexiconService.open({ db, hash: ports.hasher, decoder: ports.codec }))
			.catch((error) => {
				lexicon = undefined
				throw error
			}))
	function respond<I extends z.ZodType, O extends z.ZodType>({
		operation,
		action,
		dictionary = false,
	}: {
		operation: { request: I; response: O }
		action: (request: z.output<I>) => unknown
		dictionary?: boolean
	}) {
		return validated(operation.request, async (request): Promise<z.output<O>> => {
			try {
				return operation.response.parse({ ok: true, data: await action(request) })
			} catch (error) {
				return operation.response.parse({
					ok: false,
					error: {
						code: !dictionary && error instanceof RangeError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
						message: dictionary
							? 'Margin couldn’t read the dictionary. Reinstall Margin and try again.'
							: error instanceof RangeError
								? error.message
								: 'Margin couldn’t load the Bible text. Reinstall Margin and try again.',
					},
				})
			}
		})
	}
	const handlers = {
		...persistence.handlers,
		[ipcContract.bible.search.channel]: respond({
			operation: ipcContract.bible.search,
			action: async (request) => searchBible({ db: await getBibleDb(), request }),
		}),
		[ipcContract.bible.getPassage.channel]: respond({
			operation: ipcContract.bible.getPassage,
			action: async (request) =>
				(await getBible()).getPassage(request.translationId, request.ranges),
		}),
		[ipcContract.bible.resolveReference.channel]: respond({
			operation: ipcContract.bible.resolveReference,
			action: async (request) =>
				(await getBible()).resolveReference(
					request.reference,
					request.translationId,
					request.oldTestamentTranslationId,
				),
		}),
		[ipcContract.bible.mapPassage.channel]: respond({
			operation: ipcContract.bible.mapPassage,
			action: async (request) =>
				(await getBible()).mapPassage(request.from, request.ranges, request.to),
		}),
		[ipcContract.bible.listTranslations.channel]: respond({
			operation: ipcContract.bible.listTranslations,
			action: async () => (await getBible()).listTranslations(),
		}),
		[ipcContract.lexicon.getEntry.channel]: respond({
			operation: ipcContract.lexicon.getEntry,
			dictionary: true,
			action: async ({ id }) => (await getLexicon()).getEntry(id),
		}),
		[ipcContract.lexicon.getBdbEntries.channel]: respond({
			operation: ipcContract.lexicon.getBdbEntries,
			dictionary: true,
			action: async ({ id }) => (await getLexicon()).getBdbEntries({ id }),
		}),
		[ipcContract.lexicon.lookupSelection.channel]: respond({
			operation: ipcContract.lexicon.lookupSelection,
			dictionary: true,
			action: async (request) => (await getLexicon()).lookupSelection(request),
		}),
		[ipcContract.lexicon.copyEntry.channel]: respond({
			operation: ipcContract.lexicon.copyEntry,
			dictionary: true,
			action: async ({ id, dictionary }) => {
				const lexicon = await getLexicon()
				if (dictionary === 'bdb') {
					const entries = await lexicon.getBdbEntries({ id })
					if (!entries.length) throw new Error('Entry absent')
					ports.ui.copyText(bdbCitation({ id: strongIdSchema.parse(id), entries }))
					return null
				}
				const entry = await lexicon.getEntry(id)
				if (!entry) throw new Error('Entry absent')
				ports.ui.copyText(entryCitation(entry))
				return null
			},
		}),
		[ipcContract.lexicon.contextMenu.channel]: respond({
			operation: ipcContract.lexicon.contextMenu,
			dictionary: true,
			action: async (request) => {
				await ports.ui.showLookupMenu(request)
				return null
			},
		}),
	} satisfies MarginHandlers
	return {
		handlers,
		data,
		requestClose: persistence.requestClose,
		async close() {
			try {
				await persistence.close()
			} finally {
				await Promise.all([
					bibleDb?.then(async (db) => {
						try {
							await bible
						} finally {
							await db.close()
						}
					}),
					lexicon?.then((service) => service.close()),
				])
			}
		},
	}
}
export type Services = Awaited<ReturnType<typeof createServices>>
