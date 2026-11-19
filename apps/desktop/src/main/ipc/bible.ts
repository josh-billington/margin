import type { BrowserWindow } from 'electron'
import { ipcContract } from '@shared/ipc/contract'
import { getBibleService } from '../bible/paths'
import { handleOperation } from './boundary'

const { bible } = ipcContract

async function respond(
	operation: { response: { parse: (value: unknown) => unknown } },
	work: () => unknown,
) {
	try {
		return operation.response.parse({ ok: true, data: await work() })
	} catch (error) {
		return operation.response.parse({
			ok: false,
			error: {
				code: error instanceof RangeError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
				message:
					error instanceof RangeError
						? error.message
						: 'Margin couldn’t load the Bible text. Reinstall Margin and try again.',
			},
		})
	}
}

export function registerBibleHandlers(getWindow: () => BrowserWindow | null) {
	handleOperation(getWindow, bible.resolveReference, async (request) =>
		respond(bible.resolveReference, () =>
			getBibleService().resolveReference(
				request.reference,
				request.translationId,
				request.oldTestamentTranslationId,
			),
		),
	)
	handleOperation(getWindow, bible.getPassage, async (request) =>
		respond(bible.getPassage, () =>
			getBibleService().getPassage(request.translationId, request.ranges),
		),
	)
	handleOperation(getWindow, bible.mapPassage, async (request) =>
		respond(bible.mapPassage, () =>
			getBibleService().mapPassage(request.from, request.ranges, request.to),
		),
	)
	handleOperation(getWindow, bible.listTranslations, async () =>
		respond(bible.listTranslations, () => getBibleService().listTranslations()),
	)
}
