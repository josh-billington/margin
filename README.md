# Margin

Margin is a visual canvas for studying the Bible. It bundles 5 translations (KJV, BSB, WEB, ASV and JPS 1917). It supports searching words and phrases. It also supports offline lookups of Hebrew and Greek words in Strong, as well as Hebrew in BDB (Brown-Driver-Briggs).

<img width="2462" height="1385" alt="mockup-1795225615125" src="https://github.com/user-attachments/assets/1c1b2bb8-963d-4dc7-a39a-63661c0e824d" />

Margin is availabe as a public beta for macOS 13 and later, on Apple Silicon (Intel from the next release).

Download from the [latest release](https://github.com/josh-billington/margin/releases):
`Margin-arm64.dmg` for Apple Silicon, `Margin-x64.dmg` for Intel (ZIPs alongside).
More at [margin-bible.pages.dev](https://margin-bible.pages.dev).

The beta is unsigned and not notarized by Apple (it will be once Margin is out of beta). The first time you open it, macOS will say
it can't verify Margin. Open System Settings → Privacy & Security, click **Open Anyway**
next to the message about Margin, then confirm.

Choose **Margin → Check for Updates…** to look for a new beta. Margin never checks
on its own. Download the new version and drag it into Applications to replace the old
one. Your study files stay where they are.
Choose **Help → Send Feedback…** to report a problem, or **Help → Show Logs in Finder**
to find the error log. Margin collects no usage data, and the log holds no study text.

## Building from source

Requirements: macOS, Node 25, pnpm 11.

```sh
pnpm install          # also rebuilds native modules for Electron
pnpm import:bible     # downloads pinned KJV, BSB, WEB, ASV, and JPS 1917 sources, builds apps/desktop/resources/bible/margin-bible.sqlite
pnpm import:lexicon   # downloads pinned Strong's and BDB sources, builds apps/desktop/resources/lexicon/margin-lexicon.sqlite
pnpm dev              # run the app
```

Both importers check every downloaded file against the SHA-256 recorded in
`apps/desktop/data/sources.json`; a mismatch fails rather than accepting changed text. The
generated databases are gitignored.

Other commands: `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit), `pnpm test:e2e`
(Playwright against the built app), `pnpm dist` (unsigned macOS `.app`, DMG, and ZIP
in `apps/desktop/release/`). `pnpm dist` and the signed `dist:release` first check that
both imported databases open with the current schema and answer a search and a dictionary
lookup, and that a tldraw licence key is set; they stop before building if not. Both
leave Node's inspector disabled. `pnpm dist:test` builds a separate, inspectable `.app` in
`apps/desktop/release/test/` that the packaged Playwright test drives; never distribute it.

### tldraw licence key

The canvas uses the [tldraw SDK](https://tldraw.dev), which is not open source.
Development builds need no key. A production build without a valid key blanks the
canvas a few seconds after it opens. For your own builds, get a key from
[tldraw](https://tldraw.dev/get-a-license/hobby) and put it in `.env`:

```sh
cp .env.example .env
# VITE_TLDRAW_LICENSE_KEY=...
```

The packaged app loads from `file://`, so a key limited to a web domain will not
work there. It needs hosts `*` or tldraw's native-app option.

## Licences and credits

Margin's own code, website, and artwork are under the
[PolyForm Noncommercial License 1.0.0](LICENSE). 

You may use, modify, and share them for free for any noncommercial purpose, including personal study, religious
observance, and use by churches, schools, and charities. Commercial use is not permitted; contact me if you want a commercial licence.

Credits

- **KJV**: from [eBible.org](https://ebible.org); see `apps/desktop/resources/bible/kjv-rights.html`
- **BSB, WEB, and ASV 1901**: public-domain texts from [eBible.org](https://ebible.org);
  notices are in `apps/desktop/resources/bible/{bsb,web,asv}-rights.html`. “World English Bible”
  is a trademark of eBible.org; modified text must use a different name.
- **JPS 1917**: from [Sefaria](https://www.sefaria.org); see `apps/desktop/resources/bible/jps1917-rights.txt`
- **Strong's dictionaries**: [Open Scriptures](https://github.com/openscriptures/strongs),
  CC BY-SA 3.0. The generated lexicon data is an adaptation under the same licence;
  attribution and checksums are in `apps/desktop/resources/lexicon/lexicon.manifest.json`
- **Brown-Driver-Briggs (1906)**: Digital edition and lexical indexes by the
  [Open Scriptures Hebrew Bible Project](https://github.com/openscriptures/HebrewLexicon/tree/21c9add13bc727d3a951361778e97e3ff7afd1ce),
  under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The original text
  is public domain. Margin converts the XML to structured definitions, expands
  grammatical abbreviations, and links entries to Strong's numbers using the supplied indexes.
  Attribution, checksums, and coverage are in the bundled lexicon manifest.
- **Versification data**: see `apps/desktop/resources/bible/versification-license.txt`
- **Fonts**: Gochi Hand, IBM Plex, and Shantell Sans under the SIL Open Font
  Licence (`apps/desktop/resources/fonts/`)
- **tldraw SDK**: under the [tldraw licence](https://github.com/tldraw/tldraw/blob/main/LICENSE.md)
