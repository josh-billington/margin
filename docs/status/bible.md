# Scripture data — 2026-11-02 (local), retrieval 2026-11-03 UTC

Implemented in the assigned Bible/shared Bible/import/data/resources areas.
No package, dependency, renderer, library, or appData changes were needed.

## Sources and importer

- KJV: eBible `https://ebible.org/Scriptures/eng-kjv_usfm.zip`, source edition
  standardized 1769 text, source files dated 2026-09-26; archive Last-Modified
  2026-10-30T06:47:12Z. Supplied-word `add` and nested `+add` runs survive.
  Raw archive SHA-256: `206085ace5494f7eb46975990c0734fd8354e5ecce4d12cc74ce6f1aa8efd129`.
- JPS: the 39 named Sefaria exports of **The Holy Scriptures: A New Translation
  (JPS 1917)**, never merged English text. Discovered through index commit
  `Sefaria/Sefaria-Export@32d7bcf7e82882a854e633d72b9b32e1df286c8f`.
  Each GCS URL has its immutable `generation` query parameter and a SHA-256.
  Isaiah's original generation `1790826212093926` was later purged (404). The current
  export, generation `1793504971377399` (Last-Modified 2026-11-01), is byte-identical:
  its SHA-256 equals the recorded `a01e25f1…01df`, so `data/sources.json` and the JPS
  manifest now pin that generation with no change to the bundled DB. If a pin ever
  returns different bytes, compare parsed verses against the DB before re-pinning.
  `corpus.test.ts` skips (with a console warning) when `data/raw` is incomplete instead
  of downloading; copy the raw files or run `yarn import:bible` to enable it.
  Add verses: explicit `KJV`/`JPS` qualifier > a translation toggle click in the dialog >
  the Old Testament default setting > the persisted default translation.
  All exact source URLs, retrieval timestamps, revisions, checksums, and source
  attribution are in `data/sources.json` and the edition manifests.
- The explicit `yarn import:bible` command downloads missing raw files, caches in
  ignored `data/raw/`, and verifies all bytes, including cache hits. Corrupt caches
  fail rather than being silently replaced. Normal build never runs the importer.
- Uses Electron's Node runtime to match the installed native SQLite ABI. No new
  dependencies. ZIP extraction uses Node zlib and the archive central directory.
- Readonly better-sqlite3 providers implement the existing BibleProvider interface.
  A missing corpus returns an actionable IPC error; opening ordinary app chrome
  does not eagerly open the corpus. Dev/packaged paths follow existing extraResources.
- Database contains editions/provenance, books/source metadata, and verses with
  paragraph starts and italic-annotated verse text (storage version 2; see
  Storage below). Import publishes the DB after validating the map. Manifests and
  upstream rights notices are committed; the DB is ignored.

## Storage (version 2)

- `verses.content` holds each verse as JSON `[text, italic]` runs, with runs merged
  and punctuation/whitespace always roman. `src/shared/bible/storage.ts` encodes and
  decodes; decoding re-runs the tokenizer named by `tokenizerVersion`. Tokens are
  not stored, so their JSON-key repetition is gone.
- Why derive instead of store tokens: tokenization depends only on each character's
  text and italic flag, so the stored runs are the full input. The importer checks
  every verse at build time (`JSON.stringify(decode(encode(tokens)))` must equal the
  tokens) and refuses to publish otherwise.
- Storage version is `PRAGMA user_version` and `editions.storageVersion` (now 2,
  was 1). `BibleService` refuses any other version with an actionable error.
  Verses are `WITHOUT ROWID`.
- `corpusRevision` is unchanged for both editions (`v1-8636c49305c158a1` KJV,
  `v1-5b3fc7a0c39a9761` JPS), so the versification map and passage snapshots still
  bind. Manifests differ only by the added `storageVersion: 2`.
- Size: 176,001,024 bytes → 11,350,016 bytes (about 11 MiB; 2,771 pages of 4 KiB).
- Latency, Psalm 119 (176 verses, 2,423 tokens) `getPassage`, Electron Node, 30 warm
  runs: before median 2.10 ms (min 1.84), after median 2.15 ms (min 1.72).
- Verification:
  - One-off old-vs-new comparison: all 54,308 verses (31,102 KJV, 23,206 JPS;
    1,400,381 tokens) decode to a JSON string byte-identical to the old
    `tokens` column, and paragraph flags match.
  - `scripts/import-bible/verify-corpus.ts` (run by `corpus.test.ts`) re-parses the
    pinned raw sources via `loadRawCorpus` and requires every stored verse to decode
    to the same tokens and paragraph flag. Counts are asserted at 31,102 and 23,206.
  - `src/shared/bible/storage.test.ts` covers tokenizer fixtures, supplied-word
    italics, mixed italic fragments, and empty input.
  - `yarn typecheck`, `yarn lint`, `yarn test` (137 tests), and `yarn build` pass.

## Reference and insertion contract

`resolveReference` now returns either a resolved insertion preview (existing edition,
ranges, label plus `kind`, translation, numberingSystem, notice) or a structured
reference error with code/message/candidates. Consumers must narrow `data.kind`.
Invalid syntax, unresolved names, missing chapters/verses, reverse ranges, and
cross-book ranges never guess. An explicit KJV/JPS qualifier overrides the selected
default. Whole chapters expand through SQLite's real boundaries. For JPS + NT,
the preview offers KJV and explicitly requires confirming that actual translation.
`getPassage` validates both endpoints, deduplicates overlapping ranges, and orders
verses canonically. All three Bible operations use the existing sender/frame and
zod request/response boundary.

Merge note for the parallel persistence work: `register.ts` adds the Bible handler
import, makes the callback async, and dispatches to `handleBibleRequest` after request
validation. Preserve that dispatch when replacing other stub operations. The shared
IPC contract only changes the Bible resolution response schema.

## Tokenization and superscriptions

Tokenizer version 1 preserves punctuation, per-run italics including partial words,
whitespace following tokens, contractions, and hyphenated compounds. Indices restart
in each verse. Fixtures cover quotes, contractions, compounds, whitespace, supplied
words, verse boundaries, and separate source metadata.

KJV structural headings, unnumbered `d` psalm superscriptions, and footnotes live in
`books.metadata` with chapter/verse associations; they are excluded from verse words.
Strong attributes and the paragraph pilcrow are removed. Source line padding is
trimmed. Poetry line markers do not invent paragraph breaks. JPS array numbering
is authoritative: numbered titles remain numbered verses. This pinned export has
no paragraph markup, so only chapter starts set JPS paragraphBreakBefore. Its three small-print liturgical repeats (Lamentations 5:22, Ecclesiastes 12:14,
and Malachi 3:24) are retained separately as liturgical-repeat metadata; unexpected
markup fails.

## Versification

Version 1 derives from pinned SIL English → BHS tables, with checked adaptations
for the actual JPS numbering and whole-verse split/merge content. The map has
23,135 disjoint semantic groups and complete explicit classification of both
corpora. Every map reference is checked against the exact bundled SQLite DB.
The map binds both corpus revisions and cannot silently load against updated text.

Includes Genesis/Exodus and other chapter shifts, Malachi 4 ↔ 3:19–24, Joel 2:28–3:21
↔ JPS 3–4, numbered psalm titles, Psalm 13's combined final verse, Ten Commandment
merges, Samuel/Isaiah cross-chapter splits, and Kings/Chronicles splits. Partial
selection of a multi-verse group requires confirmation; unmapped text returns an
incomplete result with reasons. The 8,025 explicit unmapped refs are 7,957 KJV NT
verses, 67 numbered JPS psalm titles, and KJV Nehemiah 7:68 (absent in JPS).
See `data/versification/README.md` for regeneration and adaptation details.

## Inventories

KJV: **31,102** verses, 66 books. JPS 1917: **23,206** verses, 39 books.
Full chapter inventories also ship in the manifests; independent per-book fixtures
were counted from source verse markers/arrays. These exact counts are tested.

| USFM |   KJV | JPS 1917 |
| ---- | ----: | -------: |
| GEN  | 1,533 |    1,533 |
| EXO  | 1,213 |    1,210 |
| LEV  |   859 |      859 |
| NUM  | 1,288 |    1,288 |
| DEU  |   959 |      956 |
| JOS  |   658 |      658 |
| JDG  |   618 |      618 |
| RUT  |    85 |       85 |
| 1SA  |   810 |      811 |
| 2SA  |   695 |      695 |
| 1KI  |   816 |      817 |
| 2KI  |   719 |      719 |
| 1CH  |   942 |      943 |
| 2CH  |   822 |      822 |
| EZR  |   280 |      280 |
| NEH  |   406 |      405 |
| EST  |   167 |      167 |
| JOB  | 1,070 |    1,070 |
| PSA  | 2,461 |    2,527 |
| PRO  |   915 |      915 |
| ECC  |   222 |      222 |
| SNG  |   117 |      117 |
| ISA  | 1,292 |    1,291 |
| JER  | 1,364 |    1,364 |
| LAM  |   154 |      154 |
| EZK  | 1,273 |    1,273 |
| DAN  |   357 |      357 |
| HOS  |   197 |      197 |
| JOL  |    73 |       73 |
| AMO  |   146 |      146 |
| OBA  |    21 |       21 |
| JON  |    48 |       48 |
| MIC  |   105 |      105 |
| NAM  |    47 |       47 |
| HAB  |    56 |       56 |
| ZEP  |    53 |       53 |
| HAG  |    38 |       38 |
| ZEC  |   211 |      211 |
| MAL  |    55 |       55 |
| MAT  | 1,071 |        — |
| MRK  |   678 |        — |
| LUK  | 1,151 |        — |
| JHN  |   879 |        — |
| ACT  | 1,007 |        — |
| ROM  |   433 |        — |
| 1CO  |   437 |        — |
| 2CO  |   257 |        — |
| GAL  |   149 |        — |
| EPH  |   155 |        — |
| PHP  |   104 |        — |
| COL  |    95 |        — |
| 1TH  |    89 |        — |
| 2TH  |    47 |        — |
| 1TI  |   113 |        — |
| 2TI  |    83 |        — |
| TIT  |    46 |        — |
| PHM  |    25 |        — |
| HEB  |   303 |        — |
| JAS  |   108 |        — |
| 1PE  |   105 |        — |
| 2PE  |    61 |        — |
| 1JN  |   105 |        — |
| 2JN  |    13 |        — |
| 3JN  |    14 |        — |
| JUD  |    25 |        — |
| REV  |   404 |        — |

## Verification and limits

- `yarn import:bible` passed and produced the full DB. Repeated cached imports
  produce the same corpus revisions and verify map references before publication.
- `yarn typecheck`, `yarn lint`, `yarn test`, and `yarn build` passed.
- Tests exercise real better-sqlite3 under Electron, every stored verse/token schema,
  contiguous token indices, SQLite integrity/foreign keys, every per-book inventory,
  all mapping refs and complete/disjoint mapping coverage, actual chapter bounds,
  parser/qualifiers/errors/NT fallback, source checksum rejection, source metadata
  separation, supplied-word italics, and response schemas. Specific map assertions
  cover Malachi, Joel across chapters, Psalms, Ten Commandments, and unmapped text.
- Existing electron-builder extraResources already includes the database/manifests/
  notices; no package edit. Path helper covers the actual nested resources location.
- A real Electron window/preload/main IPC probe passed all three Bible methods, JPS
  numbering, NT notice, invalid references/payloads, and the sender guard. Dev and
  packaged path calculations passed. A missing-cache Obadiah import downloaded the
  immutable GCS generation and verified it successfully.
- No signed distribution or full packaged Electron UI/IPC round-trip was performed.
  Release preparation must run the explicit import before packaging: the generated
  DB is intentionally absent from git. The local DB is about 11 MiB at storage
  version 2 (was 168 MiB of token JSON); still above the spec's tentative 5 MB.
- The mutable eBible URL may change; checksum failure is intentional. Retain raw
  cached files for offline reproducibility. GCS generations may eventually expire.
- Verse-level mapping cannot represent a partial verse exactly: callers must honor
  confirmation-required/incomplete results. Renderer insertion/translation controls
  remain the canvas/shell agent's responsibility.
