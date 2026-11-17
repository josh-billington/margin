import { expect, it } from 'vitest'
import { z } from 'zod'
import { jsonSchema } from './types'

it('accepts exactly what z.json accepts', () => {
	const values = [
		null,
		'text',
		true,
		1.5,
		[1, 'a', [null, { a: [false] }]],
		{ a: { b: [1, { c: 'd' }] } },
		NaN,
		Infinity,
		undefined,
		() => 1,
		new Date(),
		new Map(),
		[undefined],
		{ a: undefined },
	]
	for (const value of values)
		expect(jsonSchema.safeParse(value).success, String(value)).toBe(z.json().safeParse(value).success)
})
it('rejects cyclic values that cannot be serialised', () => {
	const cyclic: Record<string, unknown> = {}
	cyclic.self = cyclic
	expect(jsonSchema.safeParse(cyclic).success).toBe(false)
})
