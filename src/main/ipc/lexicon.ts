import { app, clipboard, Menu } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { ipcContract } from '../../shared/ipc/contract'
import { COMMAND_CHANNEL } from '../../shared/ipc/commands'
import { entryCitation } from '../../shared/lexicon/types'
import { LexiconService } from '../lexicon/service'

let service: LexiconService | undefined
function getLexicon() {
	if (!service) {
		service = new LexiconService(
			join(
				app.isPackaged
					? join(process.resourcesPath, 'resources')
					: join(app.getAppPath(), 'resources'),
				'lexicon/margin-lexicon.sqlite',
			),
		)
		app.once('will-quit', () => {
			service?.close()
			service = undefined
		})
	}
	return service
}
export async function handleLexiconRequest(
	channel: string,
	payload: unknown,
	window: BrowserWindow,
): Promise<unknown> {
	if (!Object.values(ipcContract.lexicon).some((operation) => operation.channel === channel))
		return undefined
	try {
		switch (channel) {
			case ipcContract.lexicon.copyEntry.channel: {
				const entry = getLexicon().getEntry(ipcContract.lexicon.copyEntry.request.parse(payload).id)
				if (!entry) throw new Error('Entry absent')
				clipboard.writeText(entryCitation(entry))
				return { ok: true, data: null }
			}
			case ipcContract.lexicon.contextMenu.channel: {
				const { word, multiple } = ipcContract.lexicon.contextMenu.request.parse(payload)
				await new Promise<void>((resolve) => {
					Menu.buildFromTemplate([
						{
							label: multiple ? 'Look up selection' : `Look up “${word}”`,
							click: () => window.webContents.send(COMMAND_CHANNEL, 'word.lookup'),
						},
						{ type: 'separator' },
						{ role: 'copy' },
					]).popup({ window, callback: resolve })
				})
				return { ok: true, data: null }
			}
			case ipcContract.lexicon.getEntry.channel:
				return {
					ok: true,
					data: getLexicon().getEntry(ipcContract.lexicon.getEntry.request.parse(payload).id),
				}
			case ipcContract.lexicon.lookupSelection.channel:
				return {
					ok: true,
					data: getLexicon().lookupSelection(
						ipcContract.lexicon.lookupSelection.request.parse(payload),
					),
				}
		}
	} catch {
		return {
			ok: false,
			error: {
				code: 'INTERNAL_ERROR',
				message:
					'The bundled dictionary could not be read. Reinstall Margin or run yarn import:lexicon in development.',
			},
		}
	}
}
