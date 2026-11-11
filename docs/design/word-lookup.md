# Word lookup in Margin

Phase 1 implemented 2026-11-03. The implementation status below records the offline build; later phases remain proposals.

## Recommendation

Add **Look up word** to scripture selection and the command palette. Open a
contextual popover with the original word, Strong's number, transliteration, and
dictionary definitions. Keep the canvas available while the reader studies a word.

Bundle Strong's Hebrew and Greek dictionaries and recover the KJV source tags that
Margin currently discards. Use Sefaria for optional Hebrew and Aramaic dictionary
detail. Integrate Gesenius through a separate, verified edition and source.

Strong's identifiers, Strong's dictionary, BDB, and Gesenius remain distinct in the
interface. A Strong's number helps connect entries, but does not identify one
dictionary sense or prove what an English word means in context.

The [Sefaria API research](../research/sefaria-api.md) records endpoint paths,
live results, source coverage, and example requests.

## Reader experience

1. The reader selects **created** in KJV Genesis 1:1 and chooses **Look up word**.
2. Margin finds `H1254` in the bundled source annotations and opens the lookup popover.
3. The popover shows `בָּרָא`, its transliteration, `H1254`, and the bundled Strong's
   entry. It names the source edition and separates the short definition from KJV
   renderings and derivation.
4. Dictionary tabs under the header (**Strong’s**, **BDB**, …) switch the body. A
   Sefaria-backed tab loads its entry when opened and labels it by its real source
   name, including **BDB Augmented Strong** and **BDB**.
5. **Copy with citation** copies the selected definition and its source as plain
   text, ready for an ordinary Margin note.

Use the existing whole-word selection and keyboard navigation. Preserve selection
when focus moves to the command palette or passage controls. Do not attach lookup
to an ordinary click or hover, which already participates in selection and tagging.
The popover uses screen-sized text independent of canvas zoom, supports keyboard
navigation, and returns focus to scripture on Escape.

Multiple selected words show the source-tagged words or phrases in passage order.
The reader chooses an entry. A tag that covers a phrase displays the whole tagged
phrase. Untagged words show **No source tag for this word**, with manual lookup
available. Supplied words do not acquire an inferred Strong's number.

Manual lookup accepts `H1254`, `H01254`, `G3056`, or original-script text. Normalize
leading zeroes and retain the H or G prefix. A bare number requires a Hebrew or
Greek choice because the namespaces overlap. English gloss search can wait.

For JPS, show **Choose a Hebrew word from this verse** rather than infer alignment
from English word order. Fetch the mapped source verse on request and let the
reader choose a Hebrew word for Sefaria lookup. This route needs a connection unless
the verse and definitions are cached. Manual Strong's lookup remains available
offline. Full automatic JPS word alignment is separate work.

## Existing foundations and constraints

- `src/shared/study/types.ts` defines persistent `WordTarget` identity as a verse
  and token index. Passage text is an immutable snapshot.
- `src/shared/bible/types.ts` stores display tokens without lexical annotations.
- `scripts/import-bible/usfm.ts` removes attributes from USFM word spans before
  tokenization. The pinned KJV archive still contains the original Strong's tags.
- The source has tags spanning several English words. Genesis includes
  `man's hand` under H3027, and John includes `seek ye` under G2212.
- `src/renderer/src/canvas/highlights/tagging.ts` captures selection before focus
  moves. Lookup can share the selection reader without becoming part of tagging state.
- The command registry in `src/renderer/src/app/commands.ts` owns palette actions.
- `src/shared/bible/versification.ts` and the bundled map already handle KJV and
  JPS verse-number differences, including ambiguous and incomplete mappings.
- The renderer CSP permits connections only to itself. Remote requests belong in
  the main process through the existing validated preload and IPC boundary.

## Data design

Keep lexical data separate from saved passage tokens. A generated lexical SQLite
database can contain both dictionary entries and KJV annotation spans. Its manifest
records source URLs, pinned revisions, checksums, rights, and attribution, following
the existing Bible import workflow.

An annotation span identifies its exact text edition, corpus revision, tokenizer
version, verse, first token, last token, and one or more Strong's identifiers. Each
token in a phrase resolves to the same span. Preserve all source associations and
unmapped words. Do not force a one-word-to-one-lemma model.

The importer tracks annotated character spans through the same cleanup that builds
display text. It converts those spans to existing token indices only after checking
that the resulting text and tokens exactly match the current bundled corpus.
Lexical generation must leave every display token and corpus revision unchanged.

An old study can use the new annotations when its snapshot matches the recorded
edition and token sequence. If the snapshot differs, offer manual lookup and explain
that source annotations are unavailable. Never apply the current corpus's token
positions to a changed snapshot.

Dictionary identity includes the dictionary edition and its entry identifier.
Strong's associations are separate, potentially many-to-many relationships.
Sefaria entries use `parent_lexicon` plus the exact `headword`; retain `rid` when
provided. Preserve vocalization and homograph suffixes in exact entry keys.

For Sefaria enrichment, resolve a Strong's identifier through the local dictionary
to a Hebrew headword, call the word endpoint, then compare returned `strong_number`
or `strong_numbers`. Present all matching entries rather than choose a sense.
If nothing matches the identifier, show other headword results as related entries
or show no match. Do not claim that `lookup_ref` guarantees disambiguation.

Treat upstream JSON as unknown until parsed with zod. Normalize varying Sefaria
entry shapes into a recursive sense tree with source metadata. Start with safe text
rendering of definitions. Any retained HTML formatting needs an explicit sanitizer
and controlled links before it enters the renderer.

Lookup state, request results, and cache refreshes do not enter tldraw history or
mark a study dirty. Keep downloaded definitions in app data, separate from studies
and the read-only bundled database. Cache identity includes provider, request
parameters, entry identity, and version information when supplied. Record fetch
time and attribution. Cache only editions whose reuse terms support that behavior.

## Integration boundaries

These are proposed additions, not files that already exist.

| Area                                                 | Responsibility                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/import-lexicon/`                            | Pin dictionary inputs, build lexical DB and manifest, verify corpus alignment. Parse data without evaluating downloaded JavaScript. |
| `resources/lexicon/`                                 | Generated bundled database, provenance manifests, and source notices.                                                               |
| `src/shared/lexicon/`                                | zod schemas for Strong's IDs, source spans, entries, requests, and results.                                                         |
| `src/main/lexicon/`                                  | Read local entries and spans, call Sefaria, normalize responses, and cache permitted results.                                       |
| `src/main/ipc/lexicon.ts`                            | Dispatch lexical operations through the existing sender and schema checks.                                                          |
| `src/shared/ipc/contract.ts`, `src/preload/index.ts` | Expose typed `lookupSelection`, `searchEntries`, and `getEntry` operations. These are names to confirm during implementation.       |
| `src/renderer/src/canvas/lookup/`                    | Transient lookup state and the contextual popover.                                                                                  |
| Selection reader, command registry, passage options  | Capture the selected words and expose **Look up word** consistently.                                                                |

The IPC operations accept structured identifiers and references, never arbitrary
URLs. Main constructs requests against fixed provider origins. Empty results,
unsupported sources, timeouts, and invalid responses remain distinguishable.
Request sequencing prevents an earlier result from replacing a later selection.

Margin requests a Sefaria entry when the reader opens that dictionary's tab (it may
prefetch once the popover opens). An uncached request has a bounded timeout and Retry action. Respect `Retry-After` on rate limiting and avoid
retry loops. A network failure leaves the bundled Strong's entry readable. The
reader can use a cached definition while its refresh fails.

## Delivery sequence

### 1. Offline Strong's lookup

Recover KJV tags into the separate annotation database and bundle Hebrew and Greek
Strong's data. The Open Scriptures dictionaries are a concrete candidate. Their
digital files declare CC-BY-SA, so pin the exact source and resolve the applicable
license version and redistribution notices before packaging.

Deliver selection lookup, manual Strong's lookup, the popover, clear missing-tag
states, and copy with citation. This phase supports both Testaments without Sefaria.
It adds no study-file migration.

### 2. Sefaria dictionaries and the JPS source-word chooser

Add headword lookup, source-grouped definitions, exact entry loading, cached results,
and autocomplete. Scope autocomplete to dictionaries that actually support it.
The live BDB response exceeded the requested completion limit, so cap displayed
suggestions in Margin too.

For JPS or untagged KJV selections, offer the Hebrew source verse for word selection.
Convert USFM book IDs to explicit Sefaria titles. Use the KJV-to-JPS map where needed,
then validate the requested Sefaria reference. Treat JPS numbering as a starting
point, not proof that every source edition has identical segment boundaries.
Show the full mapped verse group when mapping splits or merges verses. Explain
unmapped cases, including KJV Nehemiah 7:68 and New Testament requests.

Choose a named Hebrew edition and verify its license. Disable mixed-version filling
and retain returned edition metadata. A default `version=hebrew` response can change
as Sefaria changes its priorities.

### 3. Gesenius

Default scope is a Hebrew and Chaldee lexicon edition, rather than Gesenius's
grammar. The exact edition remains a product choice.

No Gesenius lexicon or dedicated Gesenius endpoint was found in Sefaria's catalogue,
documentation, or lexicon registry. Full in-app Gesenius requires a separate source
with verified reuse terms, entry boundaries, and a tested headword or Strong's map.
BDB remains labelled BDB.

A verified external Gesenius entry link is a possible interim implementation.
External pages stay in the system browser and do not become embedded HTML or scraped
data. Link targets must be checked before shipping. This research did not establish
a dependable entry-link template or a reusable structured Gesenius dataset.

Gesenius remains an open part of the requested feature until that source is chosen.
It does not need to delay the independently useful Strong's and Sefaria phases.

## Acceptance checks

- KJV **created**, Genesis 1:1, resolves to H1254. KJV **Word**, John 1:1, resolves
  to G3056. `H0430` and `H430` resolve to the same local entry.
- Phrase tags, untagged articles, supplied words, punctuation, and nested USFM spans
  preserve their actual source coverage. Full-corpus token equality passes.
- Selection lookup works from passage controls and the command palette with mouse
  and keyboard. Tagging, text selection, arrows, and focus shortcuts retain their behavior.
- A changed saved snapshot never receives a guessed source annotation. An unchanged
  old study works without rewriting its file.
- Sefaria's nested senses, singular and plural Strong's fields, duplicate headwords,
  empty arrays, and JSON error objects produce explicit UI states.
- Diacritics, Aramaic entries, right-to-left text, and mixed-script citations render
  correctly. Unicode normalization preserves exact entry identity.
- Fast consecutive lookups show the latest selection. Offline, timeout, and
  rate-limit cases preserve local results. Definition markup cannot execute code.
- JPS lookup asks the reader to choose a source word. Psalm titles and Malachi's
  differing numbering do not silently fetch the KJV-numbered source verse.
- Lookup alone leaves undo history, autosave state, and study JSON unchanged.
- Gesenius integration identifies the actual edition and passes source-to-entry
  spot checks before the UI offers it as Gesenius.

## Remaining decisions

The main unresolved dependency is the Gesenius edition and digitization. The
Open Scriptures distribution also needs exact license-version confirmation before
bundling. Full-corpus annotation extraction and exhaustive Sefaria coverage checks
belong to implementation validation. They were not performed in this planning pass.

## Review decisions (2026-11-03)

Reviewed against the shipped app. The data design stands (verified: the pinned KJV
USFM keeps `\w created|strong="H1254"\w*`). These decisions settle the interaction
model and scope; they override anything above that conflicts.

### Opening a lookup

The plan's "select, then choose Look up word from the palette or passage controls"
is too buried to be discovered. Use the macOS conventions people already know:

- **Right-click a word → "Look up “created”"** (native context menu, first item). Works
  in every tool, on highlighted and plain words, and on an existing multi-word
  selection ("Look up selection"). This is the primary path.
- **⌃⌘D** looks up the word under the text caret / current selection (the system
  Look Up shortcut). Also listed in the palette as **Look up word** with that keycap.
- No hover, no single-click, no double-click trigger. Double-click stays native word
  selection; a click on a highlight still opens the highlight popover.

### The popover

- One lookup at a time, anchored below the word with the same virtual-anchor pattern
  as the highlight popover (follows pan/zoom; flips above near the bottom edge; closes
  if the word leaves the viewport). Screen-sized text, not canvas-scaled. Max height
  ~60vh; the body scrolls, the header stays.
- Layout, top to bottom (implemented 2026-11-09):
  1. Header, shared by every dictionary: original word (large, correct direction) with
     the Strong's id as small muted text on the right; transliteration (italic) and
     "translated *LORD*" below. A back control above the word returns to the previous
     entry (after following a cross-reference) or to **Source words**.
  2. Dictionary switcher (segmented, `ToggleGroup`), shown only when more than one
     dictionary covers the entry. Selection persists while following cross-references.
  3. Body, owned by the selected dictionary. Strong's: the definition, then a labelled
     list: **KJV** (renderings, two lines then "Show all"), **Origin**, **Compare**
     (the trailing "Compare H…" split out of the renderings). BDB: numbered senses,
     nesting shown by indent; no KJV/Origin rows.
  4. Footer: the dictionary's own name, muted ("Strong’s Hebrew Dictionary", "BDB
     Augmented Strong"), then Copy (icon) and **Add note**. Never name the provider
     (Open Scriptures, Sefaria) in the popover, in notes, or on the clipboard; provider
     credit lives in the README "Licences and credits" section.
- Every Strong's reference in dictionary text (`H1961 (הָיָה)`) is a link that opens
  that entry in place; the back control walks the trail.
- Copy and **Add note** act on the selected dictionary. **Add note** creates a
  plain-font note with its citation and binds an arrow from the note to the looked-up
  word. One undo step.
- Code: `src/renderer/src/canvas/lookup/dictionaries.ts` registers dictionaries
  (`label`, `appliesTo`, `source`, `Body`, `copy`, `noteText`). A new dictionary adds an
  entry there and a Body component; the popover needs no change.
- Loading: one spinner (`Spinner`, delayed 200ms so local reads never flash it), never
  "Loading…" text. Initial lookup: centred in the body. Following a reference: in place
  of the Strong's id, with the current entry still readable. A fetching dictionary
  body: centred `lookup-loading` spinner in its body only; the header, tabs and other
  dictionaries stay usable. Failures show inline with Retry, in that body.
- Phrases and multi-word selections: a short list of the source-tagged words/phrases in
  verse order; picking one shows its entry in the same popover (back arrow returns).
- Untagged / supplied (italic) words: "No source word for *the* — it was added in
  translation" (for supplied words) or "No source tag for this word", plus a Strong's
  number field for manual lookup.
- Escape or click outside closes and returns focus to scripture. Looking up another
  word replaces the contents. No pinning, no multiple windows in v1.

### Network

Sefaria dictionaries load on demand when their tab is opened, with no confirmation
step or setting. Bundled Strong's stays the default tab and works offline; when the
network is unavailable a Sefaria tab shows the failure and Retry in its own body.
Cached entries show immediately and refresh quietly.

### JPS and Hebrew source words

Instead of a network-only "choose a Hebrew word" fetch, Phase 2 should bundle the
Open Scriptures Hebrew Bible (WLC text, public domain; morphology and Strong's lemmas,
CC BY 4.0 — confirm before bundling). Then a JPS lookup shows the mapped Hebrew verse
offline as a row of tappable words, each already carrying its Strong's id. Same
chooser serves untagged KJV words. Sefaria remains optional enrichment.

### Scope for the first build (Phase 1)

KJV only, offline: annotation spans + Strong's Hebrew/Greek dictionaries in a separate
lexicon DB, context menu + ⌃⌘D + palette entry, the popover above, phrase list,
untagged/supplied states, manual Strong's lookup, Add as note, Copy. JPS passages show
"Word lookup for JPS 1917 is coming — look up a Strong's number" with the manual field.
Gesenius is out of scope until a source is chosen.

## Implementation status (2026-11-03)

Phase 1 is implemented with offline KJV annotation spans and Hebrew/Greek Strong’s
entries. Run `yarn import:bible` (or restore the pinned Bible/raw inputs), then
`yarn import:lexicon` before building a distribution. The existing electron-builder
`resources/**/*` resource copy includes `resources/lexicon/margin-lexicon.sqlite`
and its provenance manifest. Generated databases and raw inputs remain gitignored.

The importer verifies all 31,102 KJV verses against the existing Bible database,
without changing Bible tokens, edition metadata, or corpus revision. The lexicon
manifest records 348,884 source spans and 14,197 entries, source pins, SHA-256
checksums, normalization, and the upstream attribution notices. Dictionary JS is
parsed as JSON data, never evaluated. Runtime access is read-only SQLite through
validated IPC; this phase adds no runtime network requests.

The native word context menu, ⌃⌘D, and palette command share the renderer command
registry. Lookup state is transient. Source phrases retain their spans; changed
study snapshots use manual lookup rather than inferred alignment. JPS, supplied,
and untagged words have explicit explanations and manual Strong’s lookup. Notes
and word-bound arrows are normal edits created together in one undo step.

Licence (resolved 2026-11-03): the Open Scriptures project states "All code in the
Open Scriptures project is released under the GPL 3.0 license, and all content is
licensed Creative Commons Attribution-Share Alike 3.0." Margin bundles only the
dictionary content (parsed as data, never executed), so it is used under CC BY-SA 3.0.
The generated lexicon DB is an adaptation and must stay CC BY-SA 3.0 with attribution;
this does not affect Margin's own code licence. Before release, show the attribution
in an About / Acknowledgements screen alongside the source notices in the manifest.
Sefaria, Gesenius, and automatic JPS alignment remain outside Phase 1.
