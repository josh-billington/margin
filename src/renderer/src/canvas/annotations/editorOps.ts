import { create } from 'zustand'
import { defaultHandleExternalTldrawContent } from 'tldraw'
import type { Editor, TLContent, TLShape, TLShapeId } from 'tldraw'
import { marginPageMetadataSchema, tagSchema } from '@shared/study/types'
import { referencedTagIds } from '@shared/study/tags'
import { z } from 'zod'
import { pageTags } from '../highlights/TagPopover'
import { writeTags } from '../tags/tagOps'
import { planDeletion } from './deletion'
import type { DeletionModel, DeletionPlan } from './deletion'
import { pairDuplicates, remapAssociation, remapHighlightIds } from './duplicate'
import { prepareImport } from './importContent'
import { blockNoun } from '../../insertion/labels'

const idOf = (shape: TLShapeId | TLShape) => (typeof shape === 'string' ? shape : shape.id)

export function deletionModel(editor: Editor, selected: readonly string[]): DeletionModel {
	const shapes = editor.getCurrentPageShapes()
	return {
		selected,
		passages: shapes.flatMap((s) =>
			s.type === 'passage'
				? [
						{
							id: s.id,
							highlights: s.props.highlights.length,
							noun: blockNoun(s.props.text.ranges, s.props.text.edition.translationId),
						},
					]
				: [],
		),
		notes: shapes.flatMap((s) =>
			s.type === 'margin-note' ? [{ id: s.id, association: s.props.association?.passageId }] : [],
		),
		arrows: shapes.flatMap((s) =>
			s.type === 'arrow'
				? [{ id: s.id, boundTo: editor.getBindingsFromShape(s.id, 'arrow').map((b) => b.toId) }]
				: [],
		),
	}
}

interface DeleteRequest {
	editor: Editor | null
	ids: string[]
	plan: DeletionPlan | null
}
export const useDeleteRequest = create<DeleteRequest>(() => ({ editor: null, ids: [], plan: null }))

export function confirmDeletion() {
	const { editor, ids } = useDeleteRequest.getState()
	useDeleteRequest.setState({ editor: null, ids: [], plan: null })
	if (!editor) return
	editor.markHistoryStoppingPoint('delete selection')
	editor.deleteShapes(ids as TLShapeId[])
}
export const cancelDeletion = () => useDeleteRequest.setState({ editor: null, ids: [], plan: null })

/** Deletes the selection, asking once when passages (and their annotations) are involved. */
export function requestDeleteSelection(editor: Editor) {
	const ids = [...editor.getSelectedShapeIds()]
	if (!ids.length || editor.getIsReadonly()) return
	const plan = planDeletion(deletionModel(editor, ids))
	if (plan.needsConfirmation) useDeleteRequest.setState({ editor, ids, plan })
	else {
		editor.markHistoryStoppingPoint('delete selection')
		editor.deleteShapes(ids as TLShapeId[])
	}
}

/** ⌘D: new shape and highlight IDs; tags reused; outside arrow targets become free points. */
export function duplicateSelection(editor: Editor) {
	const ids = [...editor.getSelectedShapeIds()]
	if (!ids.length || editor.getIsReadonly()) return
	const originals = ids.flatMap((id) => editor.getShape(id) ?? [])
	editor.markHistoryStoppingPoint('duplicate selection')
	editor.run(() => {
		editor.duplicateShapes(ids, { x: 24, y: 24 })
		const copies = editor.getSelectedShapes()
		const idMap = pairDuplicates(originals, copies)
		for (const copy of copies) {
			if (copy.type === 'passage')
				editor.updateShape({
					id: copy.id,
					type: 'passage',
					props: { highlights: remapHighlightIds(copy.props.highlights) },
				})
			else if (copy.type === 'margin-note' && idMap && copy.props.association)
				editor.updateShape({
					id: copy.id,
					type: 'margin-note',
					props: { association: remapAssociation(copy.props.association, idMap) },
				})
		}
	})
}

type MarginContent = TLContent & { marginTags?: unknown }

/**
 * Deleting passages or notes always cascades (incident arrows, associations) in one
 * transaction, whichever path triggered it; copy carries the tag catalog; paste imports it.
 */
export function installAnnotationBehavior(editor: Editor) {
	const deleteShapes = editor.deleteShapes.bind(editor)
	editor.deleteShapes = (shapes) => {
		const plan = planDeletion(deletionModel(editor, shapes.map(idOf)))
		editor.run(() => {
			for (const id of plan.clearAssociationIds)
				editor.updateShape({
					id: id as TLShapeId,
					type: 'margin-note',
					props: { association: undefined },
				})
			deleteShapes(plan.deleteIds as TLShapeId[])
		})
		return editor
	}
	editor.registerExternalContentHandler('tldraw', async (external) => {
		const content = external.content as MarginContent
		const sourceTags = z.array(tagSchema).catch([]).parse(content.marginTags)
		const passages = content.shapes.filter((s) => s.type === 'passage')
		const imported = prepareImport(passages, sourceTags, pageTags(editor))
		const byId = new Map(imported.shapes.map((s) => [s.id, s]))
		const shapes = content.shapes.map((s) => (byId.get(s.id) as TLShape | undefined) ?? s)
		// The default handler opens its own history entry; the tag import must land inside it.
		editor.run(() => {
			void defaultHandleExternalTldrawContent(editor, {
				...external,
				content: { ...content, shapes },
			})
			if (imported.added.length) writeTags(editor, imported.tags)
		})
	})
	return () => {
		editor.deleteShapes = deleteShapes
	}
}

/** Copy payload hook: attach the tags the copied highlights reference. */
export function withReferencedTags(editor: Editor, content: TLContent): TLContent {
	const used = new Set(
		referencedTagIds(
			content.shapes.flatMap((s) => (s.type === 'passage' ? [s.props.highlights] : [])),
		),
	)
	const meta = marginPageMetadataSchema.safeParse(editor.getCurrentPage().meta)
	const marginTags = (meta.success ? meta.data.tags : []).filter((t) => used.has(t.id))
	return { ...content, marginTags } as MarginContent
}
