import Database from 'better-sqlite3'
import { isDeepStrictEqual } from 'node:util'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { books } from '../../src/shared/bible/books'
import { decodeVerseTokens } from '../../src/shared/bible/storage'
import { textEditionSchema } from '../../src/shared/bible/types'
import { importUsfm } from '../import-bible/usfm'
import { readSource, sha256, sourcePinSchema } from '../import-bible/sources'
import { readZip } from '../import-bible/zip'
import { annotatedTokens, assertTokenEquality } from './spans'
import { parseDictionary } from './dictionaries'
import {
	decodeSpans,
	encodeSpans,
	tokenFingerprint,
	LEXICON_STORAGE_VERSION,
} from '../../src/shared/lexicon/storage'

const dictionaryPin = sourcePinSchema.omit({ translationId: true, book: true, retrievedAt: true })
export async function buildLexicon(root: string) {
	const pins = z
		.object({ sources: z.array(sourcePinSchema), lexiconSources: z.array(dictionaryPin).length(2) })
		.parse(JSON.parse(await readFile(join(root, 'data/sources.json'), 'utf8')))
	const kjv = pins.sources.find((pin) => pin.translationId === 'kjv')
	if (!kjv) throw new Error('Missing KJV source pin')
	const zip = readZip(await readSource(kjv, join(root, 'data/raw')))
	const dictionaries = await Promise.all(
		pins.lexiconSources.map(async (pin) => ({
			pin,
			raw: (await readSource(pin, join(root, 'data/raw'))).toString('utf8'),
		})),
	)
	const out = join(root, 'resources/lexicon')
	await mkdir(out, { recursive: true })
	const temporary = join(root, 'data/raw/margin-lexicon.build.sqlite')
	await rm(temporary, { force: true })
	const bible = new Database(join(root, 'resources/bible/margin-bible.sqlite'), {
		readonly: true,
		fileMustExist: true,
	})
	const db = new Database(temporary)
	let verseCount = 0,
		spanCount = 0,
		entryCount = 0
	try {
		const edition = textEditionSchema.parse(
			bible.prepare("SELECT * FROM editions WHERE translationId='kjv'").get(),
		)
		db.exec(`CREATE TABLE metadata (edition TEXT NOT NULL);
			CREATE TABLE verses (book TEXT, chapter INTEGER, verse INTEGER, fingerprint TEXT NOT NULL, spans BLOB NOT NULL, PRIMARY KEY(book,chapter,verse)) WITHOUT ROWID;
			CREATE TABLE entries (id TEXT PRIMARY KEY, data TEXT NOT NULL) WITHOUT ROWID;
			PRAGMA user_version = ${LEXICON_STORAGE_VERSION};`)
		db.prepare('INSERT INTO metadata VALUES (?)').run(JSON.stringify(edition))
		const insertVerse = db.prepare('INSERT INTO verses VALUES (?,?,?,?,?)')
		const insertEntry = db.prepare('INSERT INTO entries VALUES (?,?)')
		const corpusVerse = bible.prepare(
			"SELECT content FROM verses WHERE translationId='kjv' AND book=? AND chapter=? AND verse=?",
		)
		db.transaction(() => {
			for (const book of books) {
				const file = [...zip].find(([name]) => name.endsWith(`${book.id}eng-kjv.usfm`))
				if (!file) throw new Error(`Missing ${book.id}`)
				const source = file[1].toString('utf8')
				const imported = importUsfm(book.id, source)
				let chapter = 0
				for (const line of source.split(/\r?\n/)) {
					const c = /^\\c\s+(\d+)/.exec(line)
					if (c) chapter = Number(c[1])
					const v = /^\\v\s+(\d+)\s+([\s\S]*)$/.exec(line)
					if (!v) continue
					const verseNumber = Number(v[1])
					const ref = { book: book.id, chapter, verse: verseNumber }
					const verse = imported.verses.find(
						(value) => value.ref.chapter === chapter && value.ref.verse === verseNumber,
					)
					if (!verse) throw new Error(`Missing imported verse ${JSON.stringify(ref)}`)
					const text = (v[2] ?? '')
						.trim()
						.replace(/\\f\s[\s\S]*?\\f\*/g, '')
						.replace(/^¶\s*/, '')
						.trim()
					const annotated = annotatedTokens(ref, text)
					const label = `${book.id} ${chapter}:${verseNumber}`
					assertTokenEquality(annotated.tokens, verse.tokens, label)
					const row = z
						.object({ content: z.string() })
						.parse(corpusVerse.get(book.id, chapter, verseNumber))
					assertTokenEquality(annotated.tokens, decodeVerseTokens(row.content), label)
					const compact = encodeSpans(annotated.spans, verse.tokens)
					if (!isDeepStrictEqual(decodeSpans(compact, ref, verse.tokens), annotated.spans))
						throw new Error(`Lexicon span round trip failed at ${label}`)
					insertVerse.run(book.id, chapter, verseNumber, tokenFingerprint(verse.tokens), compact)
					verseCount++
					spanCount += annotated.spans.length
				}
			}
			if (
				verseCount !== 31102 ||
				z
					.object({ n: z.number() })
					.parse(bible.prepare("SELECT count(*) n FROM verses WHERE translationId='kjv'").get())
					.n !== verseCount
			)
				throw new Error('KJV inventory mismatch')
			for (const { pin, raw } of dictionaries) {
				const language = pin.filename.includes('hebrew') ? 'Hebrew' : 'Greek'
				for (const entry of parseDictionary(raw, language)) {
					insertEntry.run(entry.id, JSON.stringify(entry))
					entryCount++
				}
			}
		})()
		db.exec('VACUUM')
		if (db.pragma('integrity_check', { simple: true }) !== 'ok')
			throw new Error('Lexicon integrity check failed')
		const manifest = {
			schemaVersion: LEXICON_STORAGE_VERSION,
			importerVersion: 2,
			edition,
			verseCount,
			spanCount,
			entryCount,
			bibleSource: kjv,
			dictionarySources: pins.lexiconSources,
			license:
				'Original Strong dictionaries are public domain. The Open Scriptures digital editions are licensed CC BY-SA 3.0 (project statement: "All code in the Open Scriptures project is released under the GPL 3.0 license, and all content is licensed Creative Commons Attribution-Share Alike 3.0."). Margin bundles content only, no Open Scriptures code. The generated lexicon data is an adaptation and is shared under CC BY-SA 3.0 with attribution.',
			normalization:
				'JSON data parsed without evaluation. Fields renamed, whitespace trimmed. USFM source spans mapped to unchanged display tokens; every KJV verse compared with the read-only bundled Bible DB. No inferred tags.',
			sourceNotices: dictionaries.map(({ pin, raw }) => ({
				filename: pin.filename,
				notice: raw.slice(0, raw.indexOf('*/') + 2),
			})),
			checksum: sha256(await readFile(temporary)),
		}
		await writeFile(join(out, 'lexicon.manifest.json'), JSON.stringify(manifest, null, '\t') + '\n')
	} finally {
		db.close()
		bible.close()
	}
	await rename(temporary, join(out, 'margin-lexicon.sqlite'))
	console.info(`Lexicon: ${verseCount} verified verses, ${spanCount} spans, ${entryCount} entries`)
}
