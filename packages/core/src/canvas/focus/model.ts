import type { Editor } from 'tldraw'
import { wordBindingMetadataSchema } from '@shared/study/types'
import type { DimModel } from './dimming'

/** Reads notes and arrow terminals from the live document for the pure brightness function. */
export function dimModel(editor: Editor): DimModel {
	const shapes = editor.getCurrentPageShapes()
	return {
		notes: shapes.flatMap((s) =>
			s.type === 'margin-note' ? [{ id: s.id as string, association: s.props.association }] : [],
		),
		arrows: shapes.flatMap((s) =>
			s.type === 'arrow'
				? [
						{
							id: s.id as string,
							ends: editor.getBindingsFromShape(s.id, 'arrow').map((binding) => {
								const meta = wordBindingMetadataSchema.safeParse(binding.meta)
								return {
									toId: binding.toId as string,
									verse: meta.success ? meta.data.target.verse : undefined,
								}
							}),
						},
					]
				: [],
		),
	}
}
