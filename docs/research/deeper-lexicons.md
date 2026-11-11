# Deeper lexicons for word lookup

Checked 2026-11-09. Raw data was cloned or fetched into a scratch directory and sampled;
nothing in this repo's source changed. "Verified" means I opened the data or licence file
myself. Everything else is marked **unverified**.

Context: Margin ships Strong's offline and plans BDB through Sefaria
([design](../design/word-lookup.md), [Sefaria research](sefaria-api.md)). Gesenius is
blocked on an edition and a source.

## Recommendation

**Gesenius (Tregelles 1857).** No reusable, corrected, Strong's-keyed dataset exists.
Ship it as a **deep link only**, labelled "Gesenius (via Blue Letter Bible)", opened in
the system browser: `https://www.blueletterbible.org/lexicon/{h|g}{N}/kjv/wlc/0-1/`
(for example `…/lexicon/h1254/kjv/wlc/0-1/`). Blue Letter Bible states it uses Tregelles,
and the entry is keyed to Strong's. Do not bundle or scrape it. The only free scan text,
Internet Archive's OCR of Tregelles, is unusable (see below), so a bundled Gesenius means
a new digitization project.

**Hebrew depth without Gesenius.** If BDB needs to work offline, bundle
`openscriptures/HebrewLexicon` (BDB, CC BY 4.0, 11,845 entries, Strong's cross-walk).
It is an alternative to Sefaria's BDB, not an addition.

**Greek.** Add **Abbott-Smith's Manual Greek Lexicon** as the first deeper tab: public
domain, hand-marked TEI, 5,441 entries keyed `lemma|G####`, 5.7 MB. Add **LSJ via STEPBible
TFLSJ** (CC BY 4.0, explicitly allowed in software, keyed by extended Strong's, about
11k entries) if a classical-depth tab is wanted. Use Logeion for full LSJ as a deep link.
Treat Thayer's as optional until its licence file and OCR quality are checked.

## Comparison

| Source | Edition | Format | Licence / bundle in app? | Strong's key | Coverage and quality | Size |
|---|---|---|---|---|---|---|
| Internet Archive Tregelles scan (24 files) | Gesenius, tr. Tregelles, 1857 | djvu.txt, hOCR, PDF | Item marked public domain; **text unusable** | None | OCR is garbage: 0 Hebrew chars, English read as Greek (verified) | about 150 MB per letter (images) |
| `machshev/gesenius-lexicon` | Robinson 1854 (not Tregelles) | JSONL, TEI, SQLite via Rust pipeline | Code Apache-2.0; draft data from a public-domain scan | None | 620 entries of about 1,186 pages, AI OCR, unreviewed (verified) | 74 MB corpus |
| Blue Letter Bible | Gesenius, Tregelles | Web page (entry shown as an image) | Link only; do not scrape or embed | Yes (URL is `h1254`) | Whole lexicon; quality unverified | n/a |
| `openscriptures/HebrewLexicon` | BDB (1906) plus OSHB index | XML | CC BY 4.0 on the files, text public domain: **yes, with attribution** | Yes, via `LexicalIndex.xml`, `AugIndex.xml` | 11,845 BDB entries; "work in progress" per readme; hand-keyed | BDB 2.9 MB, index 1.8 MB |
| `translatable-exegetical-tools/Abbott-Smith` | Abbott-Smith 1922 | TEI XML | Public domain per README: **yes** | Yes, `n="λόγος\|G3056"` on 5,441 of 5,896 entries | Marked up and checked by volunteers; NT-focused | 5.7 MB |
| STEPBible `TFLSJ` | LSJ, edited by Tyndale House | Tab-separated text with HTML | CC BY 4.0, licence header says "include any part in software": **yes, with attribution** | Yes, extended Strong's (`G3056`) | 5,709 plus 5,325 "extra" entries; Bible-relevant words only | 23.8 MB plus 8.4 MB |
| STEPBible `TBESH` / `TBESG` | Brief lexicons (Hebrew from BDB, Greek from Abbott-Smith) | Tab-separated text | CC BY 4.0: yes | Yes, extended Strong's with homographs (`H1254A/B`) | 11,682 Hebrew, 11,035 Greek rows | 3.3 MB / 4.7 MB |
| PerseusDL/lexica | Full LSJ (9th ed.) | TEI XML | CC BY-SA 4.0: bundling allowed if the derived data stays CC BY-SA with credit | None; keyed by Perseus lemma (`key="lo/gos"` style) | 18,950 entries in the first file alone; 28 files; corrected Perseus text | 283 MB |
| `biblicalhumanities/Dodson-Greek-Lexicon` | Dodson | CSV, XML | CC0 `LICENSE` plus "public domain" README: yes | Yes, first column | 5,408 rows, glosses only (verified `"3056"` row) | about 1 MB |
| `nigelmsipa/thayers-greek-lexicon-dataset` | Thayer 1889 | JSONL, JSON, SQLite, CSV | README says CC0 over public-domain text; **no LICENSE file**, GitHub shows none | `strongs` on 3,791 of 6,134 entries; rest get `T…` ids | AI-driven OCR, "verified" by the author; quality unchecked | 15.8 MB JSONL |

## Spot checks

| Check | BDB (OpenScriptures) | STEPBible | Greek |
|---|---|---|---|
| **H1254 בָּרָא** | Two entries in `LexicalIndex.xml`: `b.cw.aa` "shape" (aug `a`) and `b.cx.aa` "be fat" (aug `b`). The BDB entry reads "shape, fashion, create Qal… Niph. be created…". | TBESH `H1254A` "to create", `H1254B` "to fatten", with the same BDB-style outline | n/a |
| **H3068 יְהֹוָה** | `e.az.ae` "Yahweh, the proper name of the God of Israel…". Index entry `evt` has `strong="3068"`. | TBESH `H3068G` "LORD" | n/a |
| **H430 אֱלֹהִים** | `a.dl.ad` "2570 n.m.pl… rulers, judges… gods… God". Index entry `arn` has `strong="430"`. | TBESH `H0430G` "God", plus compound rows | n/a |
| **G3056 λόγος** | n/a | TBESG `G3056` gives the Abbott-Smith text. TFLSJ `G3056` gives LSJ "computation, reckoning…". | Abbott-Smith has `λόγος\|G3056` with NT count 330 and verse refs. Dodson row `"3056"`. Thayer has `G3056` with full text. |
| **Gesenius for the three Hebrew words** | not tested: no usable data | n/a | n/a |

Caveats from the spot checks:
- Strong's maps one number to several homographs. Homograph picking needs the OSHB
  augmented Strong's (`AugIndex.xml`) or STEPBible's `A/B` suffixes. A plain `H1254`
  link should show both, as Strong's itself does.
- The Gesenius deep link was checked only as an HTTP 200 page with a Gesenius panel for
  H1254, H3068, H430. I could not load the entry image (the image endpoint returned an empty
  body without a browser session), so the entry's content is **unverified**.

## Per-source details

### Gesenius, Tregelles 1857

- **Edition.** Tregelles's translation of Gesenius, 1857. Blue Letter Bible says it chose
  this edition: "the version translated by Samuel P. Tregelles"
  ([BLB Gesenius page](https://www.blueletterbible.org/study/lexica/gesenius/)).
- **Internet Archive scan.** [Item](https://archive.org/details/GeseniusHebrewChaldeeLexiconOldTestamentScriptures.tregelles.1857.24),
  split by Hebrew letter, uploader note "combined the two copies" (Google and Microsoft
  scans). Licence field points to public domain. Fetched
  `02.GesenHebChalLexOTS.Beth…_djvu.txt` (421 KB): **0 Hebrew characters** in 258,497, and
  English text is mis-recognised as Greek/garbage (for example "πα]οοίνο, τ Πποίμου…").
  Search for the Beth entries `ברא` and "to create" found nothing. This OCR cannot be
  used for headwords, Strong's mapping, or text. Only the page images and PDFs have value.
- **`machshev/gesenius-lexicon`.** [Repo](https://github.com/machshev/gesenius-lexicon),
  Apache-2.0 for code. The README calls the corpus "an explicitly OCR draft" and says the
  Tregelles scan still needs an owner-selected registration. The only machine corpus is
  `robinson-1854.jsonl` with 620 entry records of a 1,186-page book, with no Strong's
  numbers. Robinson 1854 is a different English translation. It is worth watching,
  not shipping.
- **Strong's-coded print edition.** The Baker Books reprint "numerically coded to Strong's
  Exhaustive concordance" is on [Internet Archive](https://archive.org/details/geseniushebrewch0000gese)
  as a borrow-only scan. The coding is modern, so it is probably not public domain
  (**unverified**). Not usable.
- **e-Sword module.** The
  [Bible Support page](http://www.biblesupport.com/e-sword-downloads/file/7454-geseniuss-hebrew-and-chaldee-lexicon-of-the-old-testament/)
  is a pointer under "Raw Module Material", with no verified module or licence.
  A `Gesenius.dct.mybible` file ships inside the BHSE bundle (per search snippet,
  **unverified**; provenance and licence unknown).
- **StudyLight** shows Gesenius per Strong's but returns HTTP 403 to automated fetches;
  not usable even as a checked link template.
- **Deep link.** `https://www.blueletterbible.org/lexicon/h1254/kjv/wlc/0-1/` returned 200.
  The page has a "Gesenius' Hebrew-Chaldee Lexicon" panel (`id="lexGesenius"`) that holds
  an image URL `/lang/lexicon/lexImage.cfm?tv=…` and a "Read the Full Entry" control.
  No stable anchor for the panel was found. The Strong's number is the key; Greek numbers
  use the same pattern (`…/lexicon/g3056/…`), which returned 200 but has no Gesenius
  panel. Respect the site's terms; link out only.

### OpenScriptures HebrewLexicon (BDB)

- **Data.** [github.com/openscriptures/HebrewLexicon](https://github.com/openscriptures/HebrewLexicon),
  commit `21c9add` (2019-09-02). `BrownDriverBriggs.xml` (11,845 entries, 2.9 MB),
  `LexicalIndex.xml` (1.8 MB), `AugIndex.xml`, `HebrewStrong.xml` (2.7 MB), XSD schemas.
- **Licence (verified in `readme.md`).** "released under the Creative Commons Attribution
  4.0 International license. The actual text of Brown, Driver, Briggs and Strong's Hebrew
  dictionary remain in the public domain. … credit the Open Scriptures Hebrew Bible
  Project." GitHub shows no licence file; the README is the evidence. The design doc's
  open point (exact licence version) is therefore **CC BY 4.0**.
- **Cross-walk.** `LexicalIndex.xml` entries carry `<xref bdb="…" strong="1254" aug="a" twot="278"/>`.
  Reliable for the three spot checks. It is hand-edited and the README describes the
  lexicon as a work in progress, so coverage of BDB's non-Strong's entries is incomplete
  (**unverified** against the full 11,845).
- **Quality.** Hand-transcribed XML, not raw OCR. Scripture references are incomplete,
  per the README.

### Abbott-Smith

- **Data.** [github.com/translatable-exegetical-tools/Abbott-Smith](https://github.com/translatable-exegetical-tools/Abbott-Smith),
  `abbott-smith.tei.xml` (5.7 MB, latest commit 2024-06-30). Edition: *A Manual Greek Lexicon
  of the New Testament*, Scribner's, 1922.
- **Licence.** README: "The lexicon … including the marked up version in this repository,
  is in the public domain." The bundled PDF carries its own source restrictions; do not
  ship the PDF.
- **Keys.** 5,441 of 5,896 `<entry n="…">` values are `lemma|G####` (verified
  `λόγος|G3056`). Entries include `<ref osisRef>` verse refs, LXX Hebrew `n="H1697"`
  cross-references and NT occurrence counts. The other 455 entries need lemma matching.
- **Quality.** The README says marking up and checking are complete, with named proofreaders.
  Reading level suits a "deeper than Strong's" tab.

### STEPBible Tyndale lexicons (TFLSJ, TBESG, TBESH)

- **Data.** [github.com/STEPBible/STEPBible-Data](https://github.com/STEPBible/STEPBible-Data),
  folder `Lexicons/`, pushed 2026-11-02.
- **Licence (verified in file headers).** "Data created by www.STEPBible.org based on work
  at Tyndale House Cambridge (CC BY 4.0)." The header lists "Include any part of this data
  in software" as allowed, requires attribution to Tyndale House and STEPBible.org, and
  asks users not to repost the files elsewhere. Bundling in an app is allowed. No
  separate LICENSE file; the repo shows none.
- **TFLSJ.** Full LSJ text edited for Bible use, with abbreviations expanded and HTML
  markup. G3056 present. Only 5,709 + 5,325 Greek entries, not the whole LSJ.
- **TBESG / TBESH.** The Greek brief lexicon is Abbott-Smith edited to extended Strong's
  (G3056 carries the Abbott-Smith text). The Hebrew brief lexicon's forms are "based on
  BDB, then normalised" and give homograph splits (`H1254A` create, `H1254B` fatten).
  Extended Strong's letters (A/B/G/H/I) need handling when mapping from KJV tags.

### Perseus / Logeion (LSJ)

- **Data.** [PerseusDL/lexica](https://github.com/PerseusDL/lexica): 28 TEI files for LSJ
  under `CTS_XML_TEI/perseus/pdllex/grc/lsj`, 283 MB, 9th edition. Licence CC BY-SA 4.0
  (GitHub licence and file `<availability>` verified).
- **Keys.** Perseus lemma keys, no Strong's numbers. Joining to G numbers means lemma
  matching, which is lossy for accent and variants (**unverified** error rate).
- **Fit.** Too large to bundle whole; TFLSJ is the Strong's-keyed subset. For the full
  text, link to Logeion: `https://logeion.uchicago.edu/{lemma}` (URL-encode; returned
  HTTP 200 for λόγος, but it is a script-rendered page, so the entry itself is
  **unverified**).

### Dodson

- [biblicalhumanities/Dodson-Greek-Lexicon](https://github.com/biblicalhumanities/Dodson-Greek-Lexicon),
  CC0 `LICENSE`; README says public domain. CSV columns: Strong's, Goodrick-Kohlenberger,
  Greek word, brief and longer definitions. `"3056"` is "a word, speech, divine utterance,
  analogy". Gloss-level only; adds little beyond Strong's. Not recommended.

### Thayer's

- [nigelmsipa/thayers-greek-lexicon-dataset](https://github.com/nigelmsipa/thayers-greek-lexicon-dataset)
  (updated 2026-06-26): 6,134 entries, JSONL, JSON, SQLite, CSV. Strong's mapped on 3,791,
  provisional `T…` ids on 2,343. G3056 entry present with full text. README: public domain
  text, dataset CC0. GitHub reports no licence, and extraction is "AI-driven OCR", so
  text accuracy and mapping were not audited here. Use only after a sample check and
  confirming the licence in writing from the author.

## Not found

- No corrected, Tregelles-based Gesenius dataset (XML, JSON, TEI, SQLite) with Strong's keys.
- No SWORD module for Gesenius or Thayer in CrossWire's `mods.d` listing (Abbott-Smith,
  BDB glosses and Strong's modules are there). Listing checked by name only.
- No verified Gesenius entry-link template other than Blue Letter Bible's Strong's page.
  Bible Hub does not carry it (**unverified**).

## Next steps

1. Gesenius tab = BLB deep link, system browser, labelled with the source.
2. Prototype Abbott-Smith import: parse `n="lemma|G####"`, store the TEI body as sanitized
   HTML, keep NT count and verse refs. Fall back to lemma match for the other 455 entries.
3. Decide on TFLSJ for LSJ depth; map extended Strong's to plain `G####` in the importer.
4. If an offline Gesenius is a hard requirement, scope a Tregelles OCR project using a
   better scan (the Internet Archive page images or a Hathi/Google scan) and check
   licence and quality before any data is shown as "Gesenius".
5. Add attributions to About: OpenScriptures (CC BY 4.0), Tyndale House / STEPBible
   (CC BY 4.0), Perseus if used (CC BY-SA 4.0).
