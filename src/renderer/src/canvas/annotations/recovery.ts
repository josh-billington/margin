import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import { validateHighlights, isValidWordTarget } from '@shared/study/annotationValidation'
import { marginPageMetadataSchema, wordBindingMetadataSchema } from '@shared/study/types'
import type { Highlight } from '@shared/study/types'
import { derived } from '../bindings/derived'
import { pageTags } from '../highlights/TagPopover'

interface Invalid {
	kind: 'highlight' | 'binding'
	passageId: string
	reason: string
	highlight?: Highlight
	bindingId?: string
	target?: unknown
}

/**
 * SPEC §7.4: validate every highlight and word binding against its owning snapshot.
 * Invalid highlights move into page meta `invalidAnnotations` (not attached to other words);
 * invalid bindings are recorded and left untouched. The user is told how many were affected.
 */
export function validateLoadedAnnotations(editor: Editor) {
	const found: Invalid[] = []
	const passages = editor.getCurrentPageShapes().filter((s) => s.type === 'passage')
	for (const passage of passages) {
		if (passage.type !== 'passage') continue
		const { valid, invalid } = validateHighlights(passage.props.text, passage.props.highlights)
		for (const item of invalid)
			found.push({
				kind: 'highlight',
				passageId: passage.id,
				reason: item.reason,
				highlight: item.highlight,
			})
		if (invalid.length)
			derived(editor, () =>
				editor.updateShape({ id: passage.id, type: 'passage', props: { highlights: valid } }),
			)
		for (const binding of editor.getBindingsToShape(passage.id, 'arrow')) {
			const meta = wordBindingMetadataSchema.safeParse(binding.meta)
			if (!meta.success) {
				if ('target' in (binding.meta ?? {}))
					found.push({
						kind: 'binding',
						passageId: passage.id,
						reason: 'Unreadable word target',
						bindingId: binding.id,
					})
				continue
			}
			if (!isValidWordTarget(passage.props.text, meta.data.target))
				found.push({
					kind: 'binding',
					passageId: passage.id,
					reason: 'Target word is absent from the snapshot',
					bindingId: binding.id,
					target: meta.data.target,
				})
		}
	}
	if (!found.length) return 0
	const meta = marginPageMetadataSchema.safeParse(editor.getCurrentPage().meta)
	const known = new Set(
		(meta.success ? (meta.data.invalidAnnotations ?? []) : []).map((r) => JSON.stringify(r)),
	)
	const fresh = found.filter((f) => !known.has(JSON.stringify(f)))
	if (fresh.length)
		derived(editor, () =>
			editor.updatePage({
				id: editor.getCurrentPageId(),
				meta: {
					...editor.getCurrentPage().meta,
					schemaVersion: 1,
					tags: pageTags(editor),
					invalidAnnotations: JSON.parse(
						JSON.stringify([
							...(meta.success ? (meta.data.invalidAnnotations ?? []) : []),
							...fresh,
						]),
					),
				},
			}),
		)
	const highlights = found.filter((f) => f.kind === 'highlight').length
	toast.warning(
		`${found.length} annotation${found.length === 1 ? '' : 's'} no longer match their scripture text` +
			` (${highlights} highlight${highlights === 1 ? '' : 's'}, ${found.length - highlights} arrow target${found.length - highlights === 1 ? '' : 's'}). They were kept in this study's recovery data and not moved to other words.`,
		{ duration: 12000 },
	)
	return found.length
}
