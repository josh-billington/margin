import { BibleService } from '@margin/services/bible/provider'
import { openDatabase } from './database'

export const openBible = (path: string) => BibleService.open(openDatabase(path))
export type { BibleService } from '@margin/services/bible/provider'
