import { LexiconService } from '@margin/services/lexicon/service'
import { openDatabase } from './database'

export const openLexicon = (path: string) => LexiconService.open({ db: openDatabase(path) })
export type { LexiconService } from '@margin/services/lexicon/service'
