import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { describeImpact } from '../canvas/annotations/deletion'
import type { DeletionPlan } from '../canvas/annotations/deletion'
import { cancelDeletion, confirmDeletion, useDeleteRequest } from '../canvas/annotations/editorOps'

function deleteTitle({ passages, passageNoun }: DeletionPlan['counts']) {
	if (passages > 1) return `Delete ${passages} scripture blocks?`
	if (!passageNoun) return 'Delete this scripture block?'
	return passageNoun.endsWith('s') ? `Delete these ${passageNoun}?` : `Delete this ${passageNoun}?`
}

/** One confirmation for deleting verses and chapters, listing what else goes with them (SPEC §4.6). */
export function DeleteConfirm() {
	const plan = useDeleteRequest((state) => state.plan)
	return (
		<AlertDialog.Root open={plan !== null} onOpenChange={(open) => !open && cancelDeletion()}>
			<AlertDialog.Portal>
				<AlertDialog.Overlay className="dialog-overlay" />
				<AlertDialog.Content className="dialog-panel">
					<AlertDialog.Title>{plan ? deleteTitle(plan.counts) : ''}</AlertDialog.Title>
					<AlertDialog.Description>
						{plan ? describeImpact(plan.counts) : ''} You can undo this.
					</AlertDialog.Description>
					<div className="dialog-actions">
						<AlertDialog.Cancel asChild>
							<button className="button">Cancel</button>
						</AlertDialog.Cancel>
						<AlertDialog.Action asChild>
							<button className="button button-danger" onClick={confirmDeletion}>
								Delete
							</button>
						</AlertDialog.Action>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	)
}
