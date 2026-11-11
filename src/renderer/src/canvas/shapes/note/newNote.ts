import { usePreferences } from '../../../lib/preferences'

/** New notes follow the plain-font default setting (SPEC §6.2). */
export const newNoteProps = () => ({ font: usePreferences.getState().defaultNoteFont })
