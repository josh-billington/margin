import { z } from 'zod'
import { FileError } from '@margin/services/ports'

const pluginErrorSchema = z.object({ code: z.string().optional(), message: z.string() })

export function fileError({ error, path }: { error: unknown; path: string }): unknown {
	if (error instanceof FileError) return error
	const parsed = pluginErrorSchema.safeParse(error)
	if (!parsed.success) return error
	const { code, message } = parsed.data
	const kind = (() => {
		if (code === 'ENOENT') return 'missing'
		if (code === 'EEXIST') return 'exists'
		if (code === 'EACCES' || code === 'EPERM') return 'denied'
		if (code === 'EROFS') return 'readOnly'
		if (code === 'ENOSPC') return 'full'
		if (code === 'OS-PLUG-FILE-0008' || code === 'OS-PLUG-FILE-0011') return 'missing'
		if (code === 'OS-PLUG-FILE-0010') return 'exists'
		if (
			/no such file|does(?:n.t| not) exist|couldn.t be opened because there is no such file/i.test(
				message,
			)
		)
			return 'missing'
		if (/already exists|file exists/i.test(message)) return 'exists'
		if (/read.only/i.test(message)) return 'readOnly'
		if (/no space|disk.*full|(?:not|isn.t) enough.*space|insufficient.*space/i.test(message))
			return 'full'
		if (/permission|not permitted|not authorized/i.test(message)) return 'denied'
		return null
	})()
	return kind ? new FileError(kind, path, { cause: error }) : error
}
