import type { ComponentType } from 'react'
import type { LexiconEntry } from '@shared/lexicon/types'
import { dictionaryName, entryCitation } from '@shared/lexicon/types'
import { StrongsEntry } from './StrongsEntry'

export interface DictionaryBodyProps {
	/** The Strong's entry the popover is showing; other dictionaries key off its id and lemma. */
	entry: LexiconEntry
	/** Open another Strong's entry in place (cross-references). */
	follow: (id: string) => void
}

/**
 * One dictionary tab in the word lookup. The header (word, transliteration, Strong's number) is
 * shared; each dictionary owns its body, its name, and what Copy and Add note produce.
 * A dictionary that fetches (BDB from Sefaria) loads inside its Body, showing
 * `<div className="lookup-loading"><Spinner label="Loading BDB" /></div>` until it has content.
 */
export interface Dictionary {
	id: string
	/** Tab label: short, sentence case. */
	label: string
	appliesTo: (entry: LexiconEntry) => boolean
	/** The dictionary's own name for the footer ("Strong’s Hebrew Dictionary", "BDB Augmented
	 * Strong"). Never the provider we got it from (Open Scriptures, Sefaria): provider credit is
	 * in the README only, not on screen, in notes, or on the clipboard. */
	name: (entry: LexiconEntry) => string
	Body: ComponentType<DictionaryBodyProps>
	copy: (entry: LexiconEntry) => Promise<void>
	noteText: (entry: LexiconEntry) => string
}

const strongs: Dictionary = {
	id: 'strongs',
	label: 'Strong’s',
	appliesTo: () => true,
	name: dictionaryName,
	Body: StrongsEntry,
	copy: async (entry) => {
		const result = await window.margin.lexicon.copyEntry({ id: entry.id })
		if (!result.ok) throw new Error(result.error.message)
	},
	noteText: entryCitation,
}

/** In tab order. The switcher only appears when more than one applies to the entry. */
export const dictionaries: Dictionary[] = [strongs]
