export class UserFacingError extends Error {}

export function userMessage(error: unknown, fallback: string): string {
	return error instanceof UserFacingError ? error.message : fallback
}
