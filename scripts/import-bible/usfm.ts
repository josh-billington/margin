import { tokenize } from '../../src/shared/bible/tokenizer'
import type { TextRun } from '../../src/shared/bible/tokenizer'
import type { BookId, Verse } from '../../src/shared/bible/types'

export interface SourceMetadata {
	chapter: number
	verse: number | null
	kind: string
	text: string
}
export interface ImportedBook {
	id: BookId
	verses: Verse[]
	metadata: SourceMetadata[]
}

export function usfmRuns(source: string): TextRun[] {
	const cleaned = source.replace(/\\\+?w\s+([^|]*?)\|[^\\]*\\\+?w\*/g, '$1')
	const runs: TextRun[] = []
	let italic = false
	for (const part of cleaned.split(/(\\\+?[a-z]+\d*(?:\*|[ \t]?))/i)) {
		if (part.startsWith('\\')) {
			const marker = part.trim().replace('\\+', '\\')
			if (marker === '\\add' || marker === '\\it') italic = true
			else if (marker === '\\add*' || marker === '\\it*') italic = false
			else if (!/^\\\+?(nd|wj|tl|qs|bk|k)\*?$/.test(marker))
				throw new Error(`Unhandled inline USFM marker ${marker}`)
		} else if (part) {
			runs.push({ text: part, italic })
		}
	}
	if (italic) throw new Error('Unclosed supplied-word markup')
	return runs
}

export function importUsfm(book: BookId, source: string): ImportedBook {
	const verses: Verse[] = []
	const metadata: SourceMetadata[] = []
	let chapter = 0
	let paragraph = false
	let pending: { chapter: number; verse: number; text: string; paragraph: boolean } | null = null
	function withoutNotes(text: string, verse: number) {
		return text.replace(/\\([fx])\s[\s\S]*?\\\1\*/g, (note, marker: string) => {
			metadata.push({
				chapter,
				verse,
				kind: marker === 'f' ? 'footnote' : 'cross-reference',
				text: note,
			})
			return ''
		})
	}
	function flush() {
		if (!pending) return
		const { chapter, verse, text } = pending
		const tokens = tokenize(usfmRuns(text.trim()))
		// Some editions retain a verse label solely to point to text printed elsewhere.
		if (tokens.length)
			verses.push({
				ref: { book, chapter, verse },
				paragraphBreakBefore: pending.paragraph,
				tokens,
			})
		else if (
			metadata.some(
				(entry) => entry.chapter === chapter && entry.verse === verse && entry.kind === 'footnote',
			)
		)
			metadata.push({ chapter, verse, kind: 'empty-verse', text: pending.text })
		else throw new Error(`Empty verse ${book}.${chapter}.${verse}`)
		pending = null
	}
	for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
		if (!line.trim()) continue
		const match = /^\\(\w+)\s*(.*)$/.exec(line)
		if (!match) throw new Error(`Unexpected USFM line in ${book}: ${line}`)
		const marker = match[1]
		const value = (match[2] ?? '').trim()
		if (marker === 'c') {
			flush()
			chapter = Number(value)
			paragraph = true
		} else if (marker && /^(p|b|m|mi|nb|pmo|pc|pi\d*|li\d*|q\d*|qr)$/.test(marker)) {
			if (marker === 'p' || marker === 'b' || marker === 'pmo') paragraph = true
			if (value) {
				if (!pending) throw new Error(`Text outside a verse in ${book}: ${line}`)
				pending.text += ` ${withoutNotes(value, pending.verse)}`
			}
		} else if (marker === 'v') {
			flush()
			const verseMatch = /^(\d+)\s+([\s\S]*)$/.exec(value)
			if (!verseMatch) throw new Error(`Unsupported verse label: ${book} ${value}`)
			const text = (verseMatch[2] ?? '').replace(/^¶\s*/, () => {
				paragraph = true
				return ''
			})
			pending = {
				chapter,
				verse: Number(verseMatch[1]),
				text: withoutNotes(text, Number(verseMatch[1])),
				paragraph,
			}
			paragraph = false
		} else if (marker && /^(id|ide|h|toc[123]|mt\d*|d|s\d*|ms\d*|mr|r|qa|sp|cl|qc)$/.test(marker)) {
			metadata.push({
				chapter,
				verse: null,
				kind: marker === 'd' ? 'superscription' : marker,
				text: value,
			})
		} else throw new Error(`Unsupported structural USFM marker ${marker} in ${book}`)
	}
	flush()
	return { id: book, verses, metadata }
}
