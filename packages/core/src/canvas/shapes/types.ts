import { T, createShapePropsMigrationSequence } from 'tldraw'
import type { TLShape } from 'tldraw'
import { passagePropsSchema, notePropsSchema } from '@shared/study/types'
import type { PassageProps, NoteProps } from '@shared/study/types'

// h/w are cached layout, never word identity. They reconcile after DOM mount.
declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		passage: PassageProps & { h: number }
		'margin-note': NoteProps & { w: number; h: number }
	}
}
export type PassageShape = TLShape<'passage'>
export type NoteShape = TLShape<'margin-note'>
const p = passagePropsSchema.shape
const n = notePropsSchema.shape
const validator = <V>(parse: (value: unknown) => V) =>
	new T.Validator<V>((value) => {
		parse(value)
		return value as V
	})
export const passageValidators = {
	width: validator(p.width.parse),
	text: validator(p.text.parse),
	layout: validator(p.layout.parse),
	showVerseNumbers: T.boolean,
	showSuppliedWordItalics: T.boolean,
	fontScale: validator(p.fontScale.parse),
	highlights: validator(p.highlights.parse),
	pulledFrom: validator(p.pulledFrom.parse),
	h: T.positiveNumber,
}
export const noteValidators = {
	width: validator(n.width.parse),
	text: T.string,
	size: validator(n.size.parse),
	color: validator(n.color.parse),
	font: validator(n.font.parse),
	association: validator(n.association.parse),
	w: T.positiveNumber,
	h: T.positiveNumber,
}
export const passageMigrations = createShapePropsMigrationSequence({ sequence: [] })
export const noteMigrations = createShapePropsMigrationSequence({ sequence: [] })
