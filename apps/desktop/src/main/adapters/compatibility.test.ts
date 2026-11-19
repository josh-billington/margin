import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { z } from 'zod'
import { Library } from './library'
import { migrateStudy } from '@shared/study/migrations'
import {
	marginPageMetadataSchema,
	notePropsSchema,
	passagePropsSchema,
	wordBindingMetadataSchema,
} from '@shared/study/types'

it('opens the first beta study through library loading, validation, and migrations without losing annotations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'margin-compatibility-'))
	const library = new Library(join(root, 'library'), join(root, 'private'))
	try {
		await library.initialize(false)
		const fixture = new URL('./fixtures/beta-1.study.json', import.meta.url)
		const original = migrateStudy(JSON.parse(await readFile(fixture, 'utf8')))
		await copyFile(fixture, library.file(original.id))
		const study = await library.open(original.id)
		expect(study.schemaVersion).toBe(1)
		expect(study).toEqual(original)
		const recordSchema = z
			.object({
				id: z.string(),
				typeName: z.string(),
				type: z.string().optional(),
				props: z.unknown().optional(),
				meta: z.unknown(),
			})
			.passthrough()
		const records = Object.values(study.document.store).map((record) => recordSchema.parse(record))
		const passages = records
			.filter((record) => record.type === 'passage')
			.map((record) => passagePropsSchema.parse(record.props))
		expect(passages.map((passage) => passage.text.edition.translationId).sort()).toEqual([
			'kjv',
			'web',
		])
		expect(
			passages.find((passage) => passage.text.edition.translationId === 'web')?.text.verses[0]?.ref,
		).toEqual({ book: 'GEN', chapter: 1, verse: 27 })
		const highlights = passages.flatMap((passage) => passage.highlights)
		const page = records.find((record) => record.typeName === 'page')
		const metadata = marginPageMetadataSchema.parse(page?.meta)
		expect(metadata.tags).toEqual([
			{ id: '01M792B9HS7QN5TGKVP11QVK9A', name: 'Judgement', color: 'sky' },
		])
		expect(highlights).toHaveLength(2)
		expect(highlights.find((highlight) => highlight.tagId)).toMatchObject({
			tagId: metadata.tags[0]?.id,
			start: { verse: { book: 'AMO', chapter: 1, verse: 3 }, token: 5 },
			end: { verse: { book: 'AMO', chapter: 1, verse: 3 }, token: 6 },
		})
		expect(highlights.find((highlight) => highlight.color)).toMatchObject({
			color: 'amber',
			start: { token: 10 },
			end: { token: 12 },
		})
		const note = records.find((record) => record.type === 'margin-note')
		expect(notePropsSchema.parse(note?.props)).toMatchObject({
			text: 'Judgement and mercy: compare the repeated words across translations.',
			font: 'handwritten',
			color: 'ink',
		})
		const arrow = records.find((record) => record.typeName === 'shape' && record.type === 'arrow')
		expect(arrow).toBeDefined()
		const bindings = records.filter((record) => record.typeName === 'binding')
		expect(bindings).toHaveLength(2)
		expect(bindings.every((binding) => binding.fromId === arrow?.id)).toBe(true)
		expect(bindings.some((binding) => binding.toId === note?.id)).toBe(true)
		const wordBinding = bindings.find((binding) => binding.toId !== note?.id)
		expect(wordBindingMetadataSchema.parse(wordBinding?.meta).target).toEqual({
			verse: { book: 'AMO', chapter: 1, verse: 3 },
			token: 2,
		})
		expect(records.find((record) => record.id === wordBinding?.toId)?.type).toBe('passage')
	} finally {
		await library.close()
		await rm(root, { recursive: true, force: true })
	}
})
