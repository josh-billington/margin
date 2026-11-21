import type { TranslationId } from '@margin/contract/bible/types'

export const SEARCH_TABLES: Record<TranslationId, string> = {
	kjv: 'verse_search_kjv',
	jps1917: 'verse_search_jps1917',
	bsb: 'verse_search_bsb',
	web: 'verse_search_web',
	asv: 'verse_search_asv',
}

export const CHAPTER_STRIDE = 1_000
export const BOOK_STRIDE = CHAPTER_STRIDE * CHAPTER_STRIDE

export function createSearchTable(id: TranslationId) {
	return `CREATE VIRTUAL TABLE ${SEARCH_TABLES[id]} USING fts5(text, content='', tokenize='ascii')`
}
