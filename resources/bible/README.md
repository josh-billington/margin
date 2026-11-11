# Bundled scripture

Run `yarn import:bible` explicitly before development tests or distribution builds.
It uses the Electron ABI already selected by `yarn install` for better-sqlite3.
The first run downloads only pinned source files; later runs use verified raw
files in `data/raw/`. A checksum mismatch fails without accepting new source text.
To update an edition, intentionally repin `data/sources.json`, regenerate/review
the versification map, and rerun all checks. Keep a copy of the pinned raw files:
eBible's URL is mutable, and obsolete cloud-object generations may be removed.

`margin-bible.sqlite` is generated and gitignored. The importer writes it in
`data/raw/` and publishes it after corpus/map checks. It contains editions, books,
verses, paragraph starts, and book-level source metadata. Storage version 2 keeps
each verse as `[text, italic]` runs (about 29 MiB total for five editions); tokens are re-derived with
the edition's tokenizer on read, and the importer refuses any verse that does not
round-trip to identical tokens. Version 1 (168 MiB of token JSON) is rejected.

The committed manifests include exact URLs, dates/revisions, individual source
SHA-256 hashes, rights, corpus/tokenizer revisions, full per-book totals and chapter
inventories, and normalization rules. The edition `checksum` is a SHA-256 of the
JSON array of source hashes in source order, as described in each manifest.

The existing electron-builder `extraResources` copies all of `resources/` to
`resources/` under Electron's resources path, including the SQLite DB, manifests,
and rights notices. Dev reads `<appPath>/resources/bible/margin-bible.sqlite`;
packaged main reads `<process.resourcesPath>/resources/bible/margin-bible.sqlite`.
Normal `yarn build` never downloads scripture. Release preparation must explicitly
import before `yarn dist`; a build alone does not generate the ignored database.

Read `kjv-rights.html` and `jps1917-rights.txt` for the upstream notices. The KJV
notice includes the United Kingdom printing-rights exception. The importer selects
the 66 canonical KJV books from the archive, which also contains Apocrypha.

## Additional English editions

BSB, WEB (eBible `engwebp`, the updated 66-book Protestant edition), and ASV 1901
are bundled as public-domain texts. Their original notices ship as
`bsb-rights.html`, `web-rights.html`, and `asv-rights.html`. WEB's name is a trademark;
we preserve its wording. Source hashes and retrieval revisions are in `data/sources.json`.

USFM verse continuations are joined with spaces. Supplied-word italics are retained;
headings, notes, cross-references, and labels containing only a note are metadata.
BSB and ASV each contain 31,086 text-bearing verses in these sources; WEB contains
31,098. Numbered gaps are preserved. WEB prints the Romans doxology at 14:24–26;
its 16:25 label is only a pointer note and is not exposed as scripture text.

`data/versification/edition-maps.v1.json` pins all five corpus revisions and all ten
translation pairs. Run `python3 scripts/import-bible/generate-edition-maps.py` to
regenerate it from the local database after reviewing any source update. If import
stops at the mapping revision check, use `--database data/raw/margin-bible.build.sqlite`.
The existing KJV/JPS map is the reviewed baseline; same-reference English mappings
exclude missing text and apply WEB's explicit Romans relocation. Split/merge groups
remain specific to each pair, so a JPS merge does not force English-to-English
switches to expand. Re-run import and tests after reviewing the generated map.

Strong's word alignment remains KJV-only; the other editions still support lookup
by Strong's number. `yarn test` checks all five raw corpora, complete pair coverage,
verse counts, continuations, numbering exceptions, and token round-trips.
