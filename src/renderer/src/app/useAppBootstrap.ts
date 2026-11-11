import { useEffect } from 'react'
import {
	initializeStudies,
	handleLibraryEvent,
	flushBeforeClose,
	useStudySession,
} from '../study/session'
import { loadPreferences } from '../lib/preferences'
import { runCommand } from './commands'

/** Library init, preferences, IPC subscriptions (library events, flush-before-close, menu commands). */
export function useAppBootstrap() {
	useEffect(() => {
		void initializeStudies()
		void loadPreferences()
		const offLibrary = window.margin.events.onLibrary(handleLibraryEvent)
		const offFlush = window.margin.events.onFlush(flushBeforeClose)
		const offCommand = window.margin.events.onCommand(runCommand)
		// Remember the study on screen so the next launch reopens it.
		const offLastStudy = useStudySession.subscribe((state, previous) => {
			if (state.currentId && state.currentId !== previous.currentId)
				void window.margin.prefs.set({ lastOpenedStudyId: state.currentId })
		})
		return () => {
			offLibrary()
			offFlush()
			offCommand()
			offLastStudy()
		}
	}, [])
}
