# Release checks: end-to-end tests and packaging

## End-to-end tests (`yarn test:e2e`)

Playwright (`@playwright/test`, `_electron.launch`) drives the **built** app (`electron-vite build`, then `out/main`). Specs are in `e2e/*.e2e.ts`; `e2e/harness.ts` has the launch/relaunch helpers.

**Isolation.** The main process honors two test-only env vars, only when set: `MARGIN_USER_DATA_DIR` (redirects `app.getPath('userData')`, set before `whenReady`) and `MARGIN_LIBRARY_DIR` (overrides the library folder, beating any saved library path). The harness serves `out/renderer` over loopback http and points the unpackaged app at it (`ELECTRON_RENDERER_URL`) so tldraw's unlicensed-production gate (above) does not blank tests that run past 5 s; the packaged test uses the real `file://` build. Every test uses fresh temp dirs and never touches `~/Documents/Margin` or real app data. `MARGIN_GLASS=0` is set by default (the packaged test turns it back on).

| Spec | Covers |
| --- | --- |
| `m0.e2e.ts` | M0 items 6–7: new study, Add verses (Amos 1:3–5), keyboard word selection + tag, word-bound arrow, "Saved", close, relaunch with same dirs; highlight and binding (`meta.target` verse+token in the study file) intact. Stored snapshot wins over the bundled corpus: the file's `corpusRevision` and a word are edited, and the edited text renders and is not rewritten. |
| `app.e2e.ts` | Empty library launches "Untitled study" and relaunch reopens it; V/T/A/H, ⌘K, ⌘\\, F + Esc (camera returns), ←/→ and Shift word selection, ⇧⌘H opens the tag popover; native menu ids `study.new`, `sidebar.toggle`, `passage.add` via `Menu.getMenuItemById().click()`; note create / edit / options popover (size XL, plain font persisted); read-only study folder → "Save failed" + Retry → "Saved". |
| `tags.e2e.ts` | Sidebar tags: create, rename, recolor, delete with reassign. |
| `packaged.e2e.ts` | Runs `release/mac-arm64/Margin.app` (skipped if `yarn dist` has not been run): offline scripture load, `data-glass="native"`, fonts loaded, zero http(s)/ws requests (a `webRequest` listener in the main process, plus a dead `--proxy-server`), no "Liquid Glass failed" in stderr. |

Not covered: the "newer corpus" case swaps the stored snapshot rather than a second DB build; a real DB swap needs the new DB format to settle.

### Bugs found and fixed

1. **Quit blocked after a retried save.** `Autosave.flush()` re-awaited its last rejected run forever, so after a failed save + successful Retry the app could never quit ("EACCES" toast; the 15 s flush then refused). Fixed in `src/renderer/src/study/autosave.ts` (+ unit test).
2. **First click after editing a note was swallowed.** `installShortcuts` left its synthetic open menu registered after the note textarea blurred, so tldraw's `menu-click-capture` layer covered the canvas. Fixed in `src/renderer/src/canvas/tools/shortcuts.ts` (re-sync when editing ends and on `focusout`).
3. **Camera ended at the wrong zoom after F + Esc (flaky `keyboard` test).** Not a restore bug: `moveCamera` targets were right (F → 164%, Esc → 100%), but tldraw animates the viewport box with the screen width read at call time, and the sidebar toggle was still resizing the canvas (1280 → 1060 px), so the zoom ended at 83%. The test now waits for zoom *and* canvas width to settle before taking its baseline.
4. **A tldraw click-capture layer blocked sidebar clicks while a popover was open.** `installShortcuts` holds a synthetic tldraw menu open while a popover owns the keyboard, and tldraw answers with a full-viewport `.tlui-menu-click-capture` that swallowed the click on Edit tag (New tag still open). It is now `pointer-events: none` (`canvas.css`); `tags.e2e.ts` no longer presses Escape first.
5. **Temporary word-anchor underline stayed after drawing an arrow.** `word-anchor-preview` was cleared only on the next pointermove; it now also clears on pointer up/cancel (window capture) and when leaving the arrow tool / handle drag (`commands.ts`). `m0.e2e.ts` asserts it shows during the drag and is gone after release.
6. Menu items had no ids; added `id` to `command()` items in `src/main/menu.ts`.

### Open issues

- **Release blocker (also in `docs/STATUS.md`): without `VITE_TLDRAW_LICENSE_KEY`, a production tldraw blanks the editor 5 s after mount** (`LicenseProvider`, `unlicensed-production`; an `http:` origin counts as development, `file://` does not). This was the earlier "canvas blanks when Edit tag is opened with New tag open" report: the click merely landed ~5 s in. A real key is required before shipping; the packaged test is short enough to pass without one.
- Library path override is read at every start; there is no UI indication when it is active (test-only by intent).

## Packaging (`yarn dist`, unsigned, `CSC_IDENTITY_AUTO_DISCOVERY=false`)

Config fixes in `package.json`:

- Renderer-only packages (react, tldraw, radix, cmdk, …) were `dependencies`, so electron-builder copied them (12.7k files, 113 MB asar) although Vite bundles them into `out/renderer`. They are now `devDependencies`; runtime `dependencies` are only what `out/main` requires: `better-sqlite3`, `chokidar`, `electron-liquid-glass`, `ulid`, `zod`.
- `files` now excludes better-sqlite3 `deps/` and `src/`, other-platform prebuilds, and source maps.

Results (arm64, Electron 45.2.1):

| Item | Before | After |
| --- | --- | --- |
| `Margin.app` | 573 MB | 455 MB |
| `app.asar` | 113 MB | 16 MB |
| DMG / ZIP | 160 / 161 MB | 129 / 129 MB |

Of the 455 MB, `Resources/resources/bible/margin-bible.sqlite` is ~176 MB (being shrunk separately) and Electron itself is ~260 MB.

Verified in the bundle: `resources/bible/` holds `margin-bible.sqlite`, both provenance manifests and the rights texts (extraResources); `app.asar.unpacked` has `better-sqlite3/prebuilds/darwin-*.node` and `electron-liquid-glass/prebuilds/darwin-*/node.napi*.node` (so native modules load from outside the asar; better-sqlite3 uses N-API prebuilds, so there is no Electron-ABI-specific build to go stale; the packaged launch opens the DB and serves Amos 1:3–5); Gochi Hand and tldraw fonts ship as hashed woff2 in the renderer bundle (license texts in `resources/fonts/`). Packaged launch reports native glass and makes no network requests (CSP is `default-src 'none'`, `connect-src 'self'`).

## Remaining release steps

- **Signing and notarization**: Developer ID certificate, hardened runtime + entitlements (JIT/unsigned-memory entitlements Electron needs, plus library validation settings for the unpacked `.node` modules), `notarize` config, stapling; test a signed offline install (SPEC M4).
- **Universal or per-arch builds**: only arm64 is built; add x64 (the x64 prebuilds are already kept).
- **App icon** (default Electron icon today), `author` in package.json, `LSMinimumSystemVersion` (Liquid Glass needs macOS 26; older systems use the vibrancy fallback).
- **tldraw license**: tldraw 5.6.0 needs a license (key or agreed terms) for production use and none is configured in the app. Resolve that before shipping and pass any key via the `licenseKey` prop.
- Bible DB size reduction lands from the other workstream; re-run `yarn dist` and update sizes here.
- Reproduce a clean-checkout build in CI (`yarn install --frozen-lockfile`, `yarn dist`, `yarn test:e2e`).
