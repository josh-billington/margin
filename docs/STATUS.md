# Margin implementation status

## Foundation — 2026-11-02

The project foundation is ready for work in the disjoint directories defined by
`docs/ARCHITECTURE.md`. This scaffold does not implement M0 annotations, Bible
imports, or persistence.

### What exists

- Electron lifecycle, single-instance lock, macOS hidden-inset title bar, isolated
  sandboxed renderer, denied navigation/new windows/permissions, and strict CSP.
  Inline styles support tldraw and Radix positioning. Inline scripts and remote
  origins are forbidden; the Vite-generated React Refresh preamble receives an
  exact SHA-256 CSP hash in development.
- electron-vite main/preload/renderer builds, React 19, strict TypeScript, both
  requested path aliases, Tailwind v4 token mapping, ESLint, Prettier (tabs,
  single quotes, no semicolons, width 100), Vitest, and macOS electron-builder config
  (`com.margin.app`). Native dependencies rebuild through `postinstall`.
- SPEC §7.3 Bible domain types/schemas and §8.1 study types/schemas, including
  snapshot-based word targets, highlights, page tags, note/passage props, and
  the SDK's own `TLStoreSnapshot` type for `StudyFile.document`.
- One typed IPC contract with 14 operations under `library`, `bible`, `prefs`,
  and `camera`. `window.margin` exposes only these operations. Preload validates
  requests and responses; main validates sender/frame, requests, and responses.
  Valid requests return `{ ok: false, error: { code: 'NOT_IMPLEMENTED', ... } }`;
  malformed main-process requests return `INVALID_REQUEST`.
- Small shell components: TitleBar, all four SaveIndicator states, collapsible
  Sidebar, empty state, accessible tooltip buttons, Select/Arrow and zoom controls,
  and a cmdk command palette. `⌘K`/`Ctrl+K` opens the palette; `⌘\`/`Ctrl+\`
  toggles the sidebar. Canvas uses `<Tldraw hideUi colorScheme="dark" />`, the
  canvas background token, and 10–400% zoom steps. The save state is a placeholder
  `Unsaved changes`, never a claim that data reached disk.
- Every SPEC §2.1 color and 16% palette tint. Nunito Sans, Gochi Hand, Cal Sans,
  and tldraw's assets load locally. Font licenses ship under `resources/fonts/`.
  Cal Sans SemiBold is vendored from official `calcom/font` revision
  `9fe03d44f00806aadeb6d3653e37dce358554de0`; see its adjacent README and OFL.
- `scripts/import-bible/index.ts` is an explicit stub and exits with status 1.
  `data/sources.json` intentionally has an empty sources array. Reserved
  architecture directories contain `.gitkeep` files.

### Exact pinned versions

All direct package versions are exact in `package.json`; the Yarn 1 lockfile is
retained and updated.

- tldraw / @tldraw/assets: **5.6.0**. Its peer requirements are React and React DOM
  `^18.2.0 || ^19.2.1`; the chosen React version satisfies them.
- Electron: **45.2.1** (the pre-existing version, now pinned without a caret).
- React / React DOM: **19.3.1**.
- electron-vite: **6.0.0**; Vite: **7.3.7**; TypeScript: **5.9.3**.
- Tailwind CSS / @tailwindcss/vite: **4.3.4**.
- better-sqlite3: **13.0.3**; @types/better-sqlite3: **9.6.0**.
- Vitest: **4.1.12**; electron-builder: **26.18.0**.
- ESLint / @eslint/js: **9.39.5**; typescript-eslint: **8.72.1**; Prettier: **3.9.10**.

### Verification

- `yarn install --frozen-lockfile` passed, including Electron native-addon rebuild.
- `yarn typecheck`, `yarn lint`, `yarn test` (2 contract tests), and `yarn build`
  passed. Tests cover invalid study IDs/cameras and unique channels with explicit
  stub responses.
- `yarn dev` booted a real Electron window. Runtime debugger checks verified:
  canvas mount and background, bundled Cal Sans, 14 bridge methods, no renderer
  Node globals, invalid-request rejection, stub round-trip, Select/Arrow buttons,
  sidebar shortcut, command palette shortcut, and Escape dismissal. Development
  produced no runtime/CSP errors or remote asset requests. The process was stopped.
- Production build also booted through `file://` and passed those checks, with
  only the known unlicensed tldraw warnings/blocked telemetry described below.
- An in-memory `better-sqlite3` query succeeded under Electron 45.2.1, confirming
  the addon matches Electron's native ABI. No application persistence was added.
- No distribution archive, signing, notarization, or licensed offline production
  verification has been performed.

### Deviations and implementation notes

- Vitest 5.1.0 rejects the local Node 25.9.0 engine. Vitest 4.1.12 and Vite 7.3.7
  are pinned for this project's stated Node 25 setup.
- v5 APIs were checked against `node_modules/tldraw/DOCS.md`, shipped TypeScript
  declarations, and upstream asset documentation. Camera limits use the public
  `editor.setCameraOptions()` method; `options.cameraOptions` is rejected by the
  pinned published types despite appearing in their deprecation comment.
- `@tldraw/assets` is excluded from Vite dependency prebundling, which otherwise
  mishandles its `?url` imports. Its URL mapper resolves against `document.baseURI`
  so both the dev server and packaged `file://` build use bundled assets.
- In T3's terminal environment, `ELECTRON_RUN_AS_NODE=1` is inherited. Unset it
  when launching the app there: `env -u ELECTRON_RUN_AS_NODE yarn dev`.
  The installed Electron package initially lacked its executable; running
  `node node_modules/electron/install.js` downloaded it for this checkout.
- Study envelope transport validation checks JSON structure only. Complete SDK
  record validation/migration and annotation-to-snapshot validation belong to the
  future study loader with its registered custom shapes. Book IDs currently check
  USFM syntax; the Bible agent must validate against its canonical book catalog.
- The two T3 browser snapshot attempts timed out. Runtime checks used the actual
  Electron window's local debugger instead. Temporary check scripts/screenshots
  were not added as production app code.

### Next work and open issues

- **Release blocker: tldraw licensing.** Set `VITE_TLDRAW_LICENSE_KEY` at build time
  (template: `.env.example`). Local `.env` currently holds a 14-day evaluation key
  (hosts `*`, expires 2026-11-21); the hobby application is pending. A domain-only
  hobby key (`*.margin-bible.pages.dev`) fails in the packaged `file://` app: it
  needs the native flag with a URL pattern, or `*` hosts. `e2e/packaged.e2e.ts`
  waits past the 5 s check to catch this. Obtain the appropriate license/approval and verify
  its origin, watermark requirements, renewal/expiry, and packaged offline behavior.
  Without a key, the production SDK logs license errors and attempts a
  `cdn.tldraw.com/.../watermark-track.svg` request, which the offline CSP blocks.
  The watermark remains visible. The CSP has not been weakened for that request.
- `src/renderer/src/canvas/shapes/`, `bindings/`, `tools/`, `highlights/`, and
  `focus/`: custom passages/notes, word bindings, highlight algebra, reading focus,
  shortcut priorities, and M0 arrow appearance/geometry verification remain open.
- `src/shared/bible/`, `src/main/bible/`, `scripts/import-bible/`, and `data/`:
  source pinning/provenance, book catalog, reference parsing, tokenization,
  versification, SQLite corpus, and providers remain open.
- `src/main/library/`, `src/main/appData/`, and `src/renderer/src/study/`:
  default/selected library, study sessions, saving/recovery/conflicts, preferences,
  cameras, and save-state wiring remain open. IPC response schemas and StudyFile
  must be reconciled with complete SDK validation before real file writes.
- Note, Highlight, study creation, settings, and passage insertion currently show
  placeholder notices. The palette has placeholder study/navigation commands.
  No custom shape, Bible import, autosave, or filesystem write is implemented.
- `yarn dist` is configured for macOS DMG/ZIP, but icons, signing/notarization,
  distributable corpus, and release license verification remain future work.

## Plain highlights

- A highlight now carries either `tagId` or a palette `color` (zod refine; old tag-only studies load unchanged, no migration).
- Highlight mode applies a plain highlight immediately in the current color (preference `highlightColor`, default amber). Clicking a highlight opens a compact popover to recolor, remove, or add it to a tag; `⇧⌘H` / toolbar tagging is unchanged.
- Range algebra treats "identical" as same tag, or same color when untagged. Tag counts, tag focus, and tag deletion ignore plain highlights; paste, duplicate, and pull-out preserve color.
- There is no toolbar control for the current color yet; it changes when a color is picked in the highlight popover.

## Offline word lookup, Phase 1 — 2026-11-03

- Added `yarn import:lexicon`: 31,102 KJV verses checked against the bundled Bible
  DB, 348,884 source annotation spans, and 14,197 Hebrew/Greek Strong’s entries.
  The Bible DB and its corpus/tokenizer revisions are unchanged. Raw dictionary
  files and generated SQLite are gitignored; provenance is committed beside the
  generated DB, which ships through the existing resources packaging rule.
- Pinned Open Scriptures `strongs` commit
  `0acd2f251c2d35ff8db2dece4e0593979d3ac223`. Licensed CC BY-SA 3.0 (Open Scriptures
  project statement: code GPL 3.0, all content CC BY-SA 3.0; Margin bundles content
  only). The generated lexicon data is an adaptation shared under CC BY-SA 3.0; exact headers, attributions, and checksums are
  preserved in `resources/lexicon/lexicon.manifest.json`. No JS is evaluated.
- Read-only main-process lexicon service and four validated IPC operations;
  native context menu dispatches the same lookup command as ⌃⌘D and the palette.
- One screen-sized lookup popover: phrase choices, source/citation, expandable
  KJV renderings, manual IDs, supplied/untagged/JPS and old-snapshot states.
  Add as note creates a plain-font note and a bound arrow in one undo step.
  Lookup itself never changes study records. No runtime network work added.
- Unit and full-data acceptance cover normalization, punctuation, supplied words,
  phrase spans, Genesis 1:1 H1254, John 1:1 G3056, and old snapshot safety.
  Electron tests cover native-menu dispatch in every tool, shortcut/palette,
  manual/phrase lookup, transient state, note/arrow save and undo, and appearance.
  The packaged test also reads H1254 from the shipped DB with its dead proxy and
  asserts zero network requests.
- Verification: `yarn typecheck`, `yarn lint`, `yarn test` (194 tests across 25
  files), and `yarn test:e2e` (17 tests, no skips) pass. An unsigned macOS app was
  built to exercise the packaged test; it reads the bundled H1254 entry and makes
  zero network requests. The Bible DB SHA-256 remains
  `0a92e3a9be811aaac39819db3f96cfde36f3c35e43f61efb2584886c7069b5e4`.
  Screenshots: `/tmp/margin-shots/lookup/dark.png` and
  `/tmp/margin-shots/lookup/light.png`. Native menu tests activate the real first
  menu item at Electron’s popup boundary because Playwright cannot drive macOS
  native menu surfaces. App data and libraries use harness-created temporary dirs.
