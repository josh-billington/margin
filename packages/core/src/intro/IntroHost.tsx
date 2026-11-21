import { useStudySession } from '../study/session'
import { Intro } from './Intro'
import { useIntro } from './introStore'

/** Mounts the welcome intro while it is open. */
export function IntroHost() {
	const open = useIntro((state) => state.open)
	// First-run setup follows the intro and takes focus itself; a replay hands focus back.
	const setupPending = useStudySession((state) => state.setup === 'pending')
	return open ? <Intro restoreFocus={!setupPending} /> : null
}
