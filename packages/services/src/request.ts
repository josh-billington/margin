import type { z } from 'zod'

export function validated<I extends z.ZodType, T>(
	schema: I,
	action: (request: z.output<I>) => Promise<T>,
) {
	return async (payload?: unknown) => {
		const parsed = schema.safeParse(payload)
		if (!parsed.success)
			return {
				ok: false,
				error: {
					code: 'INVALID_REQUEST',
					message: 'Margin couldn’t read this request. Try again.',
				},
			} as const
		return action(parsed.data)
	}
}
