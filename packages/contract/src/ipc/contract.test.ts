import { describe, expect, it } from 'vitest'
import { ipcContract } from './contract'

describe('IPC contract', () => {
	it('rejects unsafe study identifiers and malformed camera updates', () => {
		expect(ipcContract.library.openStudy.request.safeParse({ studyId: '../escape' }).success).toBe(
			false,
		)
		expect(
			ipcContract.camera.set.request.safeParse({
				studyId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
				camera: { x: 0, y: 0, z: 100 },
			}).success,
		).toBe(false)
	})
	it('gives every operation a unique channel and a typed not-implemented response', () => {
		const channels = new Set<string>()
		for (const group of Object.values(ipcContract)) {
			for (const operation of Object.values(group)) {
				expect(channels.has(operation.channel)).toBe(false)
				channels.add(operation.channel)
				expect(
					operation.response.safeParse({
						ok: false,
						error: { code: 'NOT_IMPLEMENTED', message: 'Stub' },
					}).success,
				).toBe(true)
			}
		}
		expect(channels.size).toBe(24)
	})
})
