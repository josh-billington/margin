import Database from 'better-sqlite3'
import { BibleService } from '../../src/main/bible/provider'
import { loadEditionMaps, editionPairMap } from '../../src/shared/bible/editionMaps'
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { books } from '../../src/shared/bible/books'
import { TOKENIZER_VERSION } from '../../src/shared/bible/tokenizer'
import { STORAGE_VERSION, decodeVerseTokens, encodeVerseRuns } from '../../src/shared/bible/storage'
import { importJps, jpsSourceSchema } from './jps'
import { importUsfm } from './usfm'
import type { ImportedBook } from './usfm'
import { readSource, sha256, sourceFileSchema } from './sources'
import { readZip } from './zip'
import { translationIdSchema } from '../../src/shared/bible/types'
import type { TranslationId } from '../../src/shared/bible/types'

/** Parses the pinned raw sources in data/raw. Shared by the build and by corpus verification. */
export async function loadRawCorpus(root: string) {
	const pins = sourceFileSchema.parse(
		JSON.parse(await readFile(join(root, 'data/sources.json'), 'utf8')),
	)
	const imported: Record<TranslationId, ImportedBook[]> = {
		kjv: [],
		jps1917: [],
		bsb: [],
		web: [],
		asv: [],
	}
	const rights: Record<TranslationId, string[]> = {
		kjv: [],
		jps1917: [],
		bsb: [],
		web: [],
		asv: [],
	}

	for (const pin of pins.sources) {
		const raw = await readSource(pin, join(root, 'data/raw'))
		if (pin.translationId !== 'jps1917') {
			const zip = readZip(raw)
			const notice = zip.get('copr.htm')?.toString('utf8') ?? ''
			if (!notice.includes('Public Domain'))
				throw new Error(`${pin.translationId} rights notice missing`)
			rights[pin.translationId].push(notice)
			for (const book of books) {
				const entry = [...zip].find(([name]) =>
					name.endsWith(`${book.id}${pin.filename.replace('_usfm.zip', '')}.usfm`),
				)
				if (!entry) throw new Error(`Missing ${pin.translationId} book ${book.id}`)
				imported[pin.translationId].push(importUsfm(book.id, entry[1].toString('utf8')))
			}
		} else {
			if (!pin.book) throw new Error('JPS pin needs a book ID')
			const input: unknown = JSON.parse(raw.toString('utf8'))
			const source = jpsSourceSchema.parse(input)
			rights.jps1917.push(
				`${pin.book}\n${source.license}\n${source.versionNotes}\nSource: ${source.versionSource}`,
			)
			imported.jps1917.push(importJps(pin.book, source))
		}
	}
	if (imported.kjv.reduce((sum, book) => sum + book.verses.length, 0) !== 31102)
		throw new Error('KJV inventory is not 31,102')
	return { pins, imported, rights }
}

export async function buildBible(root: string) {
	const { pins, imported, rights } = await loadRawCorpus(root)
	const out = join(root, 'resources/bible')
	await mkdir(out, { recursive: true })
	const temporary = join(root, 'data/raw/margin-bible.build.sqlite')
	await rm(temporary, { force: true })
	const db = new Database(temporary)
	try {
		db.exec(`
			PRAGMA foreign_keys = ON;
			CREATE TABLE editions (
				translationId TEXT PRIMARY KEY, editionName TEXT NOT NULL, versificationId TEXT NOT NULL,
				upstreamUrl TEXT NOT NULL, revision TEXT NOT NULL, checksum TEXT NOT NULL,
				rights TEXT NOT NULL, attribution TEXT NOT NULL, corpusRevision TEXT NOT NULL, tokenizerVersion TEXT NOT NULL,
				storageVersion INTEGER NOT NULL
			);
			CREATE TABLE books (
				translationId TEXT NOT NULL REFERENCES editions(translationId), id TEXT NOT NULL,
				name TEXT NOT NULL, ordinal INTEGER NOT NULL, metadata TEXT NOT NULL,
				PRIMARY KEY(translationId, id)
			);
			CREATE TABLE verses (
				translationId TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
				paragraphBreakBefore INTEGER NOT NULL, content TEXT NOT NULL,
				PRIMARY KEY(translationId, book, chapter, verse),
				FOREIGN KEY(translationId, book) REFERENCES books(translationId, id)
			) WITHOUT ROWID;
			PRAGMA user_version = ${STORAGE_VERSION};
		`)
		const insertEdition = db.prepare(
			'INSERT INTO editions VALUES (@translationId,@editionName,@versificationId,@upstreamUrl,@revision,@checksum,@rights,@attribution,@corpusRevision,@tokenizerVersion,@storageVersion)',
		)
		const insertBook = db.prepare('INSERT INTO books VALUES (?,?,?,?,?)')
		const insertVerse = db.prepare('INSERT INTO verses VALUES (?,?,?,?,?,?)')
		for (const translationId of translationIdSchema.options) {
			const sources = pins.sources.filter((pin) => pin.translationId === translationId)
			const checksum = sha256(JSON.stringify(sources.map((pin) => pin.sha256)))
			const importerVersion = translationId === 'jps1917' ? 2 : translationId === 'kjv' ? 1 : 3
			const corpusRevision = `v1-${sha256(`importer-${importerVersion}:${TOKENIZER_VERSION}:${checksum}`).slice(0, 16)}`
			const edition = {
				translationId,
				editionName: {
					kjv: 'King James Version (1769), eBible.org',
					jps1917: 'The Holy Scriptures: A New Translation (JPS 1917)',
					bsb: 'Berean Standard Bible',
					web: 'World English Bible (Protestant edition)',
					asv: 'American Standard Version (1901)',
				}[translationId],
				versificationId:
					translationId === 'jps1917' ? 'jps1917-sefaria' : translationId === 'web' ? 'web' : 'kjv',
				upstreamUrl: JSON.stringify(sources.map((pin) => pin.url)),
				revision: JSON.stringify(sources.map((pin) => pin.revision)),
				checksum,
				rights: 'Public Domain',
				attribution: sources.map((pin) => pin.attribution).join('\n'),
				corpusRevision,
				tokenizerVersion: TOKENIZER_VERSION,
				storageVersion: STORAGE_VERSION,
			}
			const corpus = books.flatMap((book) =>
				imported[translationId].filter((value) => value.id === book.id),
			)
			if (
				corpus.length !== (translationId === 'jps1917' ? 39 : 66) ||
				new Set(corpus.map((book) => book.id)).size !== corpus.length
			)
				throw new Error(`Invalid ${translationId} book inventory`)
			db.transaction(() => {
				insertEdition.run(edition)
				for (const [ordinal, book] of corpus.entries()) {
					insertBook.run(
						translationId,
						book.id,
						books.find((entry) => entry.id === book.id)?.name,
						ordinal,
						JSON.stringify(book.metadata),
					)
					for (const verse of book.verses) {
						const content = encodeVerseRuns(verse.tokens)
						// Refuse to publish any verse whose stored form would not decode to the same tokens.
						if (JSON.stringify(decodeVerseTokens(content)) !== JSON.stringify(verse.tokens))
							throw new Error(
								`Verse ${book.id} ${verse.ref.chapter}:${verse.ref.verse} does not round-trip`,
							)
						insertVerse.run(
							translationId,
							book.id,
							verse.ref.chapter,
							verse.ref.verse,
							Number(verse.paragraphBreakBefore),
							content,
						)
					}
				}
			})()
			const inventory = corpus.map((book) => ({
				book: book.id,
				verses: book.verses.length,
				chapters: Array.from(
					{ length: book.verses.at(-1)?.ref.chapter ?? 0 },
					(_, index) => book.verses.filter((verse) => verse.ref.chapter === index + 1).length,
				),
			}))
			const manifest = {
				schemaVersion: 1,
				importerVersion,
				checksumAlgorithm:
					'SHA-256 of the JSON array of ordered source SHA-256 hashes; individual raw-file hashes are in sources.',
				...edition,
				sources,
				verseCount: inventory.reduce((sum, book) => sum + book.verses, 0),
				inventory,
				normalization:
					translationId === 'kjv'
						? 'Canonical 66 books only. USFM d superscriptions, headings, and footnotes retained in books.metadata, excluded from verse tokens. Strong numbers and paragraph glyphs removed; add runs preserved. Source line padding trimmed.'
						: translationId !== 'jps1917'
							? 'Canonical 66 books only. USFM d superscriptions, headings, footnotes, cross-references, and note-only verse labels retained in books.metadata, excluded from verse tokens. Strong numbers and paragraph glyphs removed; add/it runs preserved; verse continuations joined with spaces. Source line padding trimmed.'
							: 'Source verse-array indices are authoritative, including numbered psalm superscriptions. Three small-print liturgical repeats are retained in books.metadata, excluded from verse tokens. Source has no paragraph markup: only chapter starts set paragraphBreakBefore.',
			}
			await writeFile(
				join(out, `${translationId}.manifest.json`),
				JSON.stringify(manifest, null, 2) + '\n',
			)
			console.info(
				`${translationId}: ${manifest.verseCount} verses in ${corpus.length} books (${corpusRevision})`,
			)
		}
		if (db.pragma('integrity_check', { simple: true }) !== 'ok')
			throw new Error('SQLite integrity check failed')
	} finally {
		db.close()
	}
	const service = new BibleService(temporary)
	try {
		const mapInput: unknown = JSON.parse(
			await readFile(join(root, 'data/versification/edition-maps.v1.json'), 'utf8'),
		)
		const maps = loadEditionMaps(mapInput, service.listTranslations())
		for (const pair of maps.maps)
			editionPairMap(
				maps,
				pair.source,
				pair.target,
				(id) => service.providers[id].allRefs(),
				(id, book, chapter) => service.providers[id].verseNumbers(book, chapter),
			)
	} finally {
		service.close()
	}
	for (const translation of translationIdSchema.options)
		await writeFile(
			join(out, `${translation}-rights.${translation === 'jps1917' ? 'txt' : 'html'}`),
			rights[translation].join('\n\n') + (translation === 'jps1917' ? '\n' : ''),
		)
	await rename(temporary, join(out, 'margin-bible.sqlite'))
}
