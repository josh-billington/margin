import { app, clipboard, Menu } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { ipcContract } from '@shared/ipc/contract'
import { COMMAND_CHANNEL } from '@shared/ipc/commands'
import { entryCitation } from '@shared/lexicon/types'
import { openLexicon, type LexiconService } from '../adapters/lexicon'
import { handleOperation } from './boundary'

const { lexicon } = ipcContract

let service: Promise<LexiconService> | undefined
function getLexicon() {
	if (!service) {
		service = openLexicon(
			join(
				app.isPackaged
					? join(process.resourcesPath, 'resources')
					: join(app.getAppPath(), 'resources'),
				'lexicon/margin-lexicon.sqlite',
			),
		)
		app.once('will-quit', () => {
			void service?.then((value) => value.close())
			service = undefined
		})
	}
	return service
}
async function respond(work: () => unknown) {
	try {
		return { ok: true, data: await work() }
	} catch {
		return {
			ok: false,
			error: {
				code: 'INTERNAL_ERROR',
				message: 'Margin couldn’t read the dictionary. Reinstall Margin and try again.',
			},
		}
	}
}

export function registerLexiconHandlers(getWindow: () => BrowserWindow | null) {
	handleOperation(getWindow, lexicon.copyEntry, async ({ id }) =>
		lexicon.copyEntry.response.parse(
			await respond(async () => {
				const entry = await (await getLexicon()).getEntry(id)
				if (!entry) throw new Error('Entry absent')
				clipboard.writeText(entryCitation(entry))
				return null
			}),
		),
	)
	handleOperation(getWindow, lexicon.contextMenu, async ({ word, multiple }, window) =>
		lexicon.contextMenu.response.parse(
			await respond(async () => {
				await new Promise<void>((resolve) => {
					Menu.buildFromTemplate([
						{
							label: multiple ? 'Look Up Selection' : `Look Up “${word}”`,
							click: () => window.webContents.send(COMMAND_CHANNEL, 'word.lookup'),
						},
						{ type: 'separator' },
						{ role: 'copy' },
					]).popup({ window, callback: resolve })
				})
				return null
			}),
		),
	)
	handleOperation(getWindow, lexicon.getEntry, async ({ id }) =>
		lexicon.getEntry.response.parse(await respond(async () => (await getLexicon()).getEntry(id))),
	)
	handleOperation(getWindow, lexicon.lookupSelection, async (request) =>
		lexicon.lookupSelection.response.parse(
			await respond(async () => (await getLexicon()).lookupSelection(request)),
		),
	)
}
