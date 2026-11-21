import { ipcContract, type MarginApi } from '@margin/contract/ipc/contract'
import type { MarginHandlers } from './services'

export function createServiceApi({
	handlers,
}: {
	handlers: MarginHandlers
}): Pick<MarginApi, 'library' | 'bible' | 'lexicon' | 'prefs' | 'camera'> {
	return {
		library: {
			getLibrary: handlers[ipcContract.library.getLibrary.channel],
			completeSetup: handlers[ipcContract.library.completeSetup.channel],
			chooseLibraryFolder: handlers[ipcContract.library.chooseLibraryFolder.channel],
			createStudy: handlers[ipcContract.library.createStudy.channel],
			listStudies: handlers[ipcContract.library.listStudies.channel],
			openStudy: handlers[ipcContract.library.openStudy.channel],
			saveStudy: handlers[ipcContract.library.saveStudy.channel],
			closeStudy: handlers[ipcContract.library.closeStudy.channel],
			stageStudy: handlers[ipcContract.library.stageStudy.channel],
			flush: handlers[ipcContract.library.flush.channel],
			takeOver: handlers[ipcContract.library.takeOver.channel],
			deleteStudy: handlers[ipcContract.library.deleteStudy.channel],
		},
		bible: {
			search: handlers[ipcContract.bible.search.channel],
			resolveReference: handlers[ipcContract.bible.resolveReference.channel],
			getPassage: handlers[ipcContract.bible.getPassage.channel],
			mapPassage: handlers[ipcContract.bible.mapPassage.channel],
			listTranslations: handlers[ipcContract.bible.listTranslations.channel],
		},
		lexicon: {
			copyEntry: handlers[ipcContract.lexicon.copyEntry.channel],
			lookupSelection: handlers[ipcContract.lexicon.lookupSelection.channel],
			getEntry: handlers[ipcContract.lexicon.getEntry.channel],
			getBdbEntries: handlers[ipcContract.lexicon.getBdbEntries.channel],
			contextMenu: handlers[ipcContract.lexicon.contextMenu.channel],
		},
		prefs: {
			get: handlers[ipcContract.prefs.get.channel],
			set: handlers[ipcContract.prefs.set.channel],
		},
		camera: {
			get: handlers[ipcContract.camera.get.channel],
			set: handlers[ipcContract.camera.set.channel],
		},
	}
}
