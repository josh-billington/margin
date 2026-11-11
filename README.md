# Margin

A Bible study canvas for macOS. Place passages on an infinite canvas, highlight and
tag words, write notes, and draw arrows from a note to the exact word it is about.
Everything works offline, and studies are saved as plain JSON files on your Mac.

- KJV, Berean Standard Bible (BSB), World English Bible (WEB), and ASV (1901)
  are bundled in full, alongside JPS 1917 (Tanakh)
- Word-level highlights, tags, and arrows that stay attached as text reflows
- Reading focus for one passage or verse
- Offline Strong's lookup for KJV words
- Autosave with recovery, conflict copies, and external-change detection

Download: [margin-bible.pages.dev](https://margin-bible.pages.dev)

The app is not yet notarized by Apple. On first launch macOS says it cannot verify
Margin. Open System Settings → Privacy & Security, click **Open Anyway** next to
Margin, and confirm. You only need to do this once.

## About this project

Margin is a side project I designed and directed, built mostly with AI coding agents.
I wrote the spec, made the product and architecture decisions, and reviewed the
results against end-to-end tests. Forks are welcome; replies to issues may be slow.

## Building from source

Requirements: macOS, Node 25, Yarn 1.

```sh
yarn install          # also rebuilds native modules for Electron
yarn import:bible     # downloads pinned KJV, BSB, WEB, ASV, and JPS 1917 sources, builds resources/bible/margin-bible.sqlite
yarn import:lexicon   # downloads pinned Open Scriptures Strong's data, builds resources/lexicon/margin-lexicon.sqlite
yarn dev              # run the app
```

Both importers check every downloaded file against the SHA-256 recorded in
`data/sources.json`; a mismatch fails rather than accepting changed text. The
generated databases are gitignored.

Other commands: `yarn typecheck`, `yarn lint`, `yarn test` (unit), `yarn test:e2e`
(Playwright against the built app), `yarn dist` (unsigned macOS `.app`, DMG, and ZIP
in `release/`).

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

## Docs

- `docs/SPEC.md`: product spec and milestones
- `docs/ARCHITECTURE.md`: process layout and code ownership
- `docs/STATUS.md` and `docs/status/`: what is built, how it was verified, open issues
- `docs/BETA.md`: beta launch priorities

## Licences and credits

Margin's own code, website, and artwork are under the
[PolyForm Noncommercial License 1.0.0](LICENSE). You may use, modify, and share them
for free for any noncommercial purpose, including personal study, religious
observance, and use by churches, schools, and charities. Commercial use is not
permitted; contact me if you want a commercial licence.

That licence covers only Margin's own work. Bundled content keeps its own terms,
which take precedence for that content:

- **KJV**: from [eBible.org](https://ebible.org); see `resources/bible/kjv-rights.html`
- **BSB, WEB, and ASV 1901**: public-domain texts from [eBible.org](https://ebible.org);
  notices are in `resources/bible/{bsb,web,asv}-rights.html`. “World English Bible”
  is a trademark of eBible.org; modified text must use a different name.
- **JPS 1917**: from [Sefaria](https://www.sefaria.org); see `resources/bible/jps1917-rights.txt`
- **Strong's dictionaries**: [Open Scriptures](https://github.com/openscriptures/strongs),
  CC BY-SA 3.0. The generated lexicon data is an adaptation under the same licence;
  attribution and checksums are in `resources/lexicon/lexicon.manifest.json`
- **Versification data**: see `resources/bible/versification-license.txt`
- **Fonts**: Gochi Hand, IBM Plex, and Shantell Sans under the SIL Open Font
  Licence (`resources/fonts/`)
- **tldraw SDK**: under the [tldraw licence](https://github.com/tldraw/tldraw/blob/main/LICENSE.md)
