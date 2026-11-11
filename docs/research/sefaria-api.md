# Sefaria API research for word lookup

Checked 2026-11-03 with public, unauthenticated GET requests and Sefaria's current
developer documentation. Base URL: `https://www.sefaria.org`.

## Relevant endpoints

| GET path                                  | Purpose                                                                                    | Verification in this pass                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `/api/words/{word}`                       | Find dictionary entries for a written word, including inflected forms mapped to headwords. | Live Hebrew lookup returned BDB Augmented Strong and BDB entries.                                |
| `/api/words/completion/{word}/{lexicon}`  | Complete headwords within a supported dictionary.                                          | Live BDB completion worked. `Strongs Dictionary` returned a JSON error.                          |
| `/api/lexicon-entry/{lexicon}/{headword}` | Retrieve an exact dictionary entry.                                                        | Live requests succeeded for BDB Dictionary and BDB Augmented Strong.                             |
| `/api/v3/texts/{tref}`                    | Retrieve a Hebrew source verse and version metadata.                                       | Live Genesis 1:1 request succeeded.                                                              |
| `/api/texts/versions/{index}`             | Discover named editions and their license metadata.                                        | Live Genesis and BDB requests succeeded.                                                         |
| `/api/index`                              | Discover catalogue titles and categories.                                                  | Live catalogue inspection found BDB, BDB Aramaic, Jastrow, and Klein. No Gesenius title matched. |
| `/api/v2/index/{title}`                   | Inspect a work's structure and metadata.                                                   | Documented. Not live-tested here.                                                                |
| `/api/links/{tref}`                       | Retrieve connected texts, including commentary.                                            | Documented. Useful for a later related-text feature. Not live-tested here.                       |
| `/api/related/{tref}`                     | Retrieve links, sheets, topics, manuscripts, and media together.                           | Documented. Broader than word lookup. Not live-tested here.                                      |

The documented read endpoints require no API key or authorization. This does not
grant uniform reuse rights to every text. Licenses belong to particular editions.
No numeric request quota was established in this pass.

Official references:

- [Getting started and authentication](https://developers.sefaria.org/reference/getting-started)
- [Word lookup](https://developers.sefaria.org/reference/get-words)
- [Word completion](https://developers.sefaria.org/reference/get-words-completion)
- [Exact lexicon entry](https://developers.sefaria.org/reference/get-lexicon-entry)
- [Texts v3](https://developers.sefaria.org/reference/get-v3-texts)
- [Versions](https://developers.sefaria.org/reference/get-versions)
- [Catalogue](https://developers.sefaria.org/reference/get-index)
- [Index v2](https://developers.sefaria.org/reference/get-v2-index)
- [Links](https://developers.sefaria.org/reference/get-links)
- [Related content](https://developers.sefaria.org/reference/get-related)
- [Copyright and data use](https://developers.sefaria.org/docs/usage-of-our-name-and-logo)
- [Full documentation index](https://developers.sefaria.org/llms.txt)

## Word lookup behavior

The word endpoint accepts these query parameters:

| Parameter             | Meaning                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| `lookup_ref`          | Supplies passage context. It does not guarantee one entry or one sense.     |
| `never_split=1`       | Limits lookup to the input string instead of additional substring searches. |
| `always_split=1`      | Includes substring searches even if the original input has results.         |
| `always_consonants=1` | Also searches the consonantal form.                                         |

Path components must be percent-encoded individually. The following examples use
curl's `--url-query` for query encoding. Shells need UTF-8 input.

```sh
curl --get 'https://www.sefaria.org/api/words/%D7%91%D7%A8%D7%90' \
	--url-query 'lookup_ref=Genesis.1.1' \
	--url-query 'never_split=1'
```

This returned three entries in the checked response:

- `BDB Augmented Strong`, headword `בָּרָא`, `strong_number: "1254"`.
- `BDB Dictionary`, headword `בָּרָא`, `strong_numbers: ["1254", "1262"]`.
- `BDB Dictionary`, headword `בָּרָא²`, also associated with those numbers.

The cantillated form `בָּרָ֣א` also returned those entries. Both `/api/words/H1254`
and `/api/words/1254` returned empty arrays. The Greek example `λόγος` returned an
empty array. These observations support using a local Strong's identifier index
and a separate Greek dictionary, rather than treating Sefaria as an ID lookup API.
The Greek example alone does not establish exhaustive language coverage.

Entries contain `headword`, `parent_lexicon`, and nested `content.senses`.
Definitions can contain HTML. Dictionary-specific fields include grammar,
transliteration, pronunciation, and singular or plural Strong's associations.
`parent_lexicon_details` provides source and attribution information, but the
tested augmented entry did not provide an explicit license.

Sefaria's [lexicon object documentation](https://developers.sefaria.org/docs/lexicon-docs)
and [current model implementation](https://github.com/Sefaria/Sefaria-Project/blob/master/sefaria/model/lexicon.py)
describe these varying shapes. The implementation falls back to forms without
reference constraints when no context-specific forms exist. Treat context as a hint.

## Exact entries and autocomplete

```sh
curl 'https://www.sefaria.org/api/lexicon-entry/BDB%20Dictionary/%D7%91%D6%B8%D6%BC%D7%A8%D6%B8%D7%90'

curl 'https://www.sefaria.org/api/words/completion/%D7%91%D7%A8/BDB%20Dictionary?limit=5'
```

Exact entry responses wrap the document in `entry` and include `content_attr_names`.
The exact API performs NFC normalization, but does not perform inflected-form lookup.
Its documented errors include 404 for a missing entry and 409 for duplicate entries.

Completion returns pairs of unpointed and pointed headwords. The checked response
returned more than five pairs despite `limit=5`. Enforce the display limit locally.
The exact parent dictionary name matters. `Strongs Dictionary` is not an alias for
`BDB Augmented Strong` and returned an error with HTTP 200 in the tested completion
request. Handle JSON errors even when the HTTP status indicates success.

## Hebrew source text and edition selection

```sh
curl 'https://www.sefaria.org/api/v3/texts/Genesis.1.1?version=hebrew&fill_in_missing_segments=0'

curl 'https://www.sefaria.org/api/texts/versions/Genesis'

curl 'https://www.sefaria.org/api/texts/versions/BDB'
```

The checked Hebrew text request selected **Miqra according to the Masorah**, marked
`CC-BY-SA`, with right-to-left direction and Hebrew text containing HTML formatting.
The text response did not supply English-token-to-Hebrew-word alignment.

Texts v3 supports named versions through `version=language|versionTitle`. Encode
the parameter value and select an edition explicitly in production. Its
`return_format=text_only` option removes HTML and footnotes.
`fill_in_missing_segments=0` prevents filling gaps from other editions.

The checked BDB version metadata declared **Public Domain**. Genesis's version list
also contained editions marked noncommercial or copyrighted. A request for the
default English translation must not substitute for Margin's pinned JPS 1917 text.

## Strong's and Gesenius source coverage

The tested Hebrew Strong's-related source is named **BDB Augmented Strong**.
The lexicon registry also names **BDB Dictionary**, **BDB Aramaic Dictionary**,
**Jastrow Dictionary**, and **Klein Dictionary**, among other dictionaries.
Catalogue presence and lexicon presence differ. For example, the tested augmented
Strong's entries exist even though no standalone Strong's title matched the catalogue.

No Gesenius lexicon was found in the inspected catalogue or lexicon registry.
No dedicated Gesenius endpoint was found in the developer documentation.
This is a bounded source check, not a promise that every work or future addition
has been ruled out. BDB must not be presented as a Gesenius edition.

The [Open Scriptures Strong's repository](https://github.com/openscriptures/strongs)
provides Hebrew and Greek dictionary data with identifiers, lemmas, transliterations,
definitions, and KJV renderings. Both the
[Hebrew file](https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js)
and [Greek file](https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js)
declare CC-BY-SA in their headers. The headers alone do not settle the license
version. Pin a reviewed source and retain notices before distribution.

No reusable structured Gesenius dataset or dependable external entry template was
verified in this pass. A historical archive link from Gesenius.org redirected to
unrelated content during research and is excluded as an integration candidate.

## Verification limits

The checks covered representative entries and the listed catalogue queries.
They did not measure service reliability or throughput, establish full dictionary
coverage, extract every KJV annotation, or validate a packaged Electron integration.
Remote source contents and API behavior can change after this research date.
