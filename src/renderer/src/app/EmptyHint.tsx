import { shortcutFor } from './commands'

/** The only empty-study affordance: one quiet hint line beside the toolbar. */
export function EmptyHint() {
	return (
		<p className="empty-hint">
			<kbd>{shortcutFor('palette.toggle')}</kbd> to add verses
		</p>
	)
}
