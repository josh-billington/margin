# Word lookup accuracy plan

Status: plan, revised 2026-11-09 after review. Nothing here is implemented yet.
Related: [word-lookup.md](word-lookup.md), [deeper-lexicons.md](../research/deeper-lexicons.md).

## Goal

Right-click any English word in any of the five translations and get the correct
Hebrew or Greek word, every time.

- **Coverage:** every English word that translates a source word resolves to it.
  Words the translators supplied with no source word (KJV italics) say so plainly.
- **Correctness:** a wrong link is a release-blocking bug.
- **No fallback by design.** "Pick it yourself from the verse" is not an acceptable
  answer to an unaligned word. Any word left without a link is a defect, counted and
  driven to zero, not a supported state.

## Principle: measure against independent ground truth, never heuristics

Earlier quick numbers in this conversation came from regex heuristics and were wrong
in both directions. KJV's "God" tags looked 89% right; they are effectively all
legitimate (H430, H410, H433, Aramaic H426, idioms like "would God"). So every number
this plan relies on must:

1. come from a committed, unit-tested script, never a one-off command;
2. be measured against an independent source, not against the data being checked;
3. ship with a sample of the raw cases behind it (verse, English, source word, ids),
   so anyone can look at the actual examples behind the number;
4. be reproducible from pinned inputs with checksums.

## Sources

| Source | What it is | Trust | Use |
|---|---|---|---|
| **BSB translation tables** (`bsb_tables.tsv`, 85 MB, publisher) | One row per Hebrew/Greek word: Strong's, parsing, the English BSB phrase, English order, per-word Greek edition markers (TR, RP, WH, NE, NA, SBL, ECM) | Highest: made by the translators | BSB alignment; source-word inventory for every verse; independent check for the others |
| **KJV tags** (eBible USFM, from the KJV2006/CrossWire tagging) | Strong's on English words and phrases | High, unaudited | KJV alignment after Phase 2 |
| eBible BSB/WEB/ASV tags | Strong's on English words | **Unusable**: about 47% sit on "the/and/of"; Gen 1:1 tags "God" as H8064 | Never imported (test enforces it) |

BSB licence: BSB text is CC0 since 2023-04-30 ("All uses are freely permitted").
**Decision: proceed on those terms** for the tables.

## How each translation gets aligned

| Translation | Method |
|---|---|
| **BSB** | Directly from the publisher tables: map each source word's English phrase onto Margin's tokens |
| **KJV** | Existing tags, checked against the BSB tables at the level of the source word (Phase 2) |
| **ASV 1901** | Transfer from KJV: ASV is a revision of the KJV. **86.9%** of KJV's tagged words have an identical word in the same order in ASV. Those transfer as candidates; the rest get aligned in Phase 4 |
| **WEB** | Transfer from ASV (WEB modernises ASV) and KJV: **73.7%** of KJV's tagged words are directly matched. The rest get aligned in Phase 4 |
| **JPS 1917** | Transfer from KJV where wording matches (overlap still to be measured), through the KJV→JPS verse map; the rest get aligned in Phase 4 |

The overlap figures are candidates from an English diff (difflib, whole Bible), not
accuracy. Every transferred link still passes the same checks as everything else.

## Checks every link must pass

Hard invariants: any failure blocks import.

1. **Source presence:** the Strong's number exists among that verse's source words
   (from the BSB tables; for the NT, the Greek edition each translation was made
   from: KJV TR, WEB RP, ASV WH, BSB its own; for JPS, through the verse map).
2. **Source position consistency:** one source word is not claimed by two unrelated
   English words, unless the data marks it as repeated in English.
3. **Dictionary presence:** the id resolves in the bundled Strong's dictionary.
4. **Text identity:** the English tokens match the displayed text exactly (exists
   for KJV; extend to all).

Agreement checks: a disagreement is resolved by the adjudication below, not shipped.

5. **Cross-source agreement:** the link agrees with the BSB tables' choice of source
   word for the same verse (with English lemma/synonym matching).
6. **Rendering agreement:** the lemmatized English word appears in that Strong's
   entry's renderings (irregular-verb table plus suffix rules; allow-list idioms).

## Adjudication (automated, no human review queue)

Disagreements and unaligned words are resolved by agents, with the evidence on record:

- Input per case: the verse in the translation, the source words with parsing and
  Strong's, BSB's rendering of each source word, KJV's link, and the dictionary entries.
- **Two independent adjudications** (different models), each returning a link and a
  one-line rationale. They must agree, and the result must pass every hard invariant.
- Agreed results go into `data/alignment/<translation>-decisions.json` with the
  rationale and both verdicts, so every link is traceable.
- Cases where the two disagree go to a third adjudication with both rationales. Any
  case still unresolved fails the build and is listed in the audit report.

## Phases

### Phase 0: Measurement harness

- `scripts/audit-lookup/`: loads the BSB tables and every translation; reports per
  translation coverage, invariant failures, agreement rates and samples (JSON plus
  Markdown), committed and diffed on every importer change.
- Unit tests for the harness itself, on hand-built fixture verses with known answers.
- **Ground truth**: the BSB tables are the reference for BSB. For the others, a
  ~300-verse benchmark drawn from verses where KJV and BSB agree exactly on every
  source word, plus every disagreement category the harness finds. It covers
  narrative, poetry, law, prophecy, the Aramaic chapters (Dan 2–7, Ezra 4–7), the
  Gospels, the epistles, divergent numbering and phrase tags.

Exit: baseline coverage and failure counts for all five translations, with samples.
No alignment changes yet.

### Phase 1: BSB

Pin the tables with a checksum. Check the text matches the bundled BSB exactly for
the whole Bible (the tables say "3rd Printing"; check eBible's printing). Map phrases
to tokens using the English order. Run all checks. Exit: 100% of source-word
renderings placed, zero invariant failures.

### Phase 2: KJV audit

Run all checks on KJV's tags; adjudicate every disagreement; apply corrections as
decisions with rationale. Exit: zero invariant failures, zero unresolved cases,
benchmark 100%.

### Phase 3: Source-word data in the app

Bundle each verse's source words (Strong's, parsing, edition markers) from the
tables. They power the source-presence invariant, and in the popover, the header
can show parsing ("Verb · Qal · Perfect · 3ms").

### Phase 4: ASV, WEB, JPS

Transfer candidates from KJV (and ASV→WEB), check them, then align the remainder:
changed wording, reordering, modernised words. Use agent alignment against the
verse's source words and BSB's renderings, under the same two-adjudicator rule. Exit
per translation: every non-supplied word linked, zero invariant failures, zero
unresolved cases.

### Phase 5: Dictionaries

One Strong's normalizer everywhere, with property tests. Audit every BDB mapping;
show homographs together. Resolve H2007 from the BDB data directly rather than leaving
it unmapped. Track Strong's dictionary typos in an errata file.

### Phase 6: Runtime

- The popover header always shows the matched source word.
- **Report an issue**, available from the lookup popover and the app menu, broader
  than wrong matches, since we don't yet know what readers will hit. It captures
  context automatically (translation, verse, word, ids, app version) plus the
  reader's note.
- Renderer tests for selection → token on punctuation, hyphens, possessives and
  italic runs; snapshot fingerprint and stale-response guards (exist).

### Phase 7: CI gates

Benchmark 100% for every translation; all hard invariants hold; the audit report is
committed and any change to alignment output shows its diff in the PR.

## Open questions

- JPS 1917 English overlap with KJV: not yet measured (the JPS source is per-book
  JSON, not USFM).
- Report an issue: where reports go (email, GitHub issue, file to send).
