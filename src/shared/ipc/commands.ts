import { z } from 'zod'

/** Commands the native menu can ask the renderer to run (the renderer's registry owns the behavior). */
export const appCommandSchema = z.enum([
	'study.new',
	'word.lookup',
	'passage.add',
	'sidebar.toggle',
	'palette.toggle',
	'settings.open',
	'edit.undo',
	'edit.redo',
	'view.fit',
	'view.actualSize',
	'view.zoomIn',
	'view.zoomOut',
	'appearance.system',
	'appearance.light',
	'appearance.dark',
])
export type AppCommandId = z.infer<typeof appCommandSchema>
export const COMMAND_CHANNEL = 'margin:command'
