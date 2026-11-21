import type { LexiconEntry } from '@shared/lexicon/types'

export interface DictionaryBodyProps {
	entry: LexiconEntry
	follow: (id: string) => void
}

type DictionaryTab = { id: 'strongs' | 'bdb'; label: string }

export const strongsTab: DictionaryTab = { id: 'strongs', label: 'Strong’s' }
export const dictionaries: readonly DictionaryTab[] = [strongsTab, { id: 'bdb', label: 'BDB' }]
