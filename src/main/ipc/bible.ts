import { ipcContract } from '../../shared/ipc/contract'
import { getBibleService } from '../bible/paths'

/** The generic registration layer validates the sender and both schema boundaries. */
export async function handleBibleRequest(channel: string, payload: unknown): Promise<unknown> {
	if (!Object.values(ipcContract.bible).some((operation) => operation.channel === channel))
		return undefined
	try {
		const bible = getBibleService()
		switch (channel) {
			case ipcContract.bible.resolveReference.channel: {
				const request = ipcContract.bible.resolveReference.request.parse(payload)
				return {
					ok: true,
					data: bible.resolveReference(
						request.reference,
						request.translationId,
						request.oldTestamentTranslationId,
					),
				}
			}
			case ipcContract.bible.getPassage.channel: {
				const request = ipcContract.bible.getPassage.request.parse(payload)
				return { ok: true, data: await bible.getPassage(request.translationId, request.ranges) }
			}
			case ipcContract.bible.mapPassage.channel: {
				const request = ipcContract.bible.mapPassage.request.parse(payload)
				return { ok: true, data: bible.mapPassage(request.from, request.ranges, request.to) }
			}
			case ipcContract.bible.listTranslations.channel:
				return { ok: true, data: bible.listTranslations() }
		}
	} catch (error) {
		return {
			ok: false,
			error: {
				code: error instanceof RangeError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
				message:
					error instanceof RangeError
						? error.message
						: 'Bundled scripture could not be read. Run yarn import:bible in development or reinstall Margin.',
			},
		}
	}
}
