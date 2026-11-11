# Margin architecture guide

Read `docs/SPEC.md` first. This file fixes the concrete layout and conventions every contributor (human or agent) follows.

## Stack

- Package manager: **yarn 1** (lockfile exists). Node 25 locally.
- Shell: Electron (already in devDependencies) + **electron-vite**.
- UI: React 19 + TypeScript (strict). Styling: **Tailwind CSS v4** wired to the CSS tokens in SPEC §2.1 (`src/renderer/src/styles/tokens.css`).
- UI libraries (prefer these over hand-rolled widgets):
  - **Radix UI primitives** (`@radix-ui/react-popover`, `-dialog`, `-tooltip`, `-dropdown-menu`, `-alert-dialog`, `-toggle-group`, `-slider`) for popovers, dialogs, menus.
  - **cmdk** for the `⌘K` command palette.
  - **sonner** for notices/toasts.
  - **lucide-react** for icons.
- Canvas: **tldraw** pinned to an exact version (no caret). Default UI hidden (`hideUi`), Margin supplies its own chrome.
- Temporary shared UI state: **zustand** (focus mode, sidebar open, active tool mirror, popovers).
- Validation: **zod** at IPC boundaries and for file envelopes.
- IDs: **ulid** for study / tag / highlight IDs.
- Main process: **better-sqlite3** (Bible DB), **chokidar** (library watcher), `write-file-atomic`-style logic implemented in-house (temp file + fsync + rename).
- Fonts: `@fontsource/nunito-sans`, `@fontsource/gochi-hand`, Cal Sans (vendored woff2 + OFL license in `resources/fonts/cal-sans/`). Never load from network.
- Tests: **vitest** for pure logic (main + shared + renderer logic). Playwright-electron optional later.

## Directory layout

```
src/
  shared/                 # Pure TS, no Node or DOM imports. Used by main + renderer.
    bible/                # Domain types (SPEC §7.3), book catalog (USFM IDs + aliases), reference parser, versification map types
    study/                # StudyFile envelope, MarginPageMetadata, Tag, Highlight, schemas (zod), migrations
    ipc/                  # IPC channel names + request/response types (single source of truth)
    ids.ts                # ulid helpers
  main/
    index.ts, lifecycle.ts # app lifecycle: single-instance lock, startup order, activate/quit
    window/               # create.ts (BrowserWindow, show logic), glass.ts (no-op seam for Liquid Glass)
    security.ts, menu.ts  # navigation/permission hardening; native app menu dispatching renderer commands over IPC
    ipc/                  # ipcMain handlers; validate every payload with zod
    bible/                # BibleProvider impls backed by SQLite (kjv, jps1917), DB open/query
    library/              # library folder, library.json index rebuild, study file IO, atomic writes,
                          # save queue per study, recovery versions, watcher, conflict handling
    appData/              # prefs, per-study camera state (Application Support/Margin)
  preload/
    index.ts              # contextBridge: exposes window.margin typed API (from shared/ipc)
  renderer/
    index.html
    src/
      main.tsx, App.tsx   # App = AppProviders > AppShell + DialogsHost; hooks: useAppBootstrap, useGlobalShortcuts
      styles/             # tokens.css, fonts.css, tailwind entry
      app/                # uiStore, editorStore, commands.ts (single command registry: palette, shortcuts, menu); shell: TitleBar, Sidebar, Toolbar, CommandPalette, EmptyStates, SaveIndicator
      canvas/             # tldraw integration
        MarginCanvas.tsx  # <Tldraw> with custom shapeUtils/bindingUtils/tools, hideUi
        shapes/passage/   # PassageShapeUtil, PassageComponent, word DOM, highlight rendering, measurement
        shapes/note/      # NoteShapeUtil
        bindings/         # word-target arrow binding logic / geometry sync
        tools/            # Highlight tool, Note tool tweaks
        highlights/       # pure highlight range algebra (split/merge/replace) — unit tested
        focus/            # focus mode state + camera logic + dimming
      study/              # renderer-side study session: load/save via preload API, autosave debounce, dirty state, history per study
      lib/                # small utilities
scripts/
  import-bible/           # Pinned importers: fetch (explicit), verify checksum, tokenize, write SQLite + provenance manifest
data/
  sources.json            # pinned upstream URLs, revisions, sha256 checksums
  versification/          # kjv<->jps1917 mapping (versioned JSON)
  fixtures/               # tokenizer fixtures
resources/
  bible/                  # built margin-bible.sqlite (gitignored) + provenance manifests (committed)
  fonts/
docs/
```

## Rules

- `src/shared` never imports from `electron`, `node:*`, or DOM. Keep domain logic there and unit test it.
- The renderer never touches the filesystem; everything goes through `window.margin` (preload) with zod-validated payloads.
- tldraw document is the single source of truth for passages, notes, arrows, bindings, tags (tags live in the page `meta`). No parallel arrays.
- Word identity = `{ verse: VerseRef, token: number }` into the passage's immutable snapshot. Pixel geometry is derived, never persisted as identity.
- Derived geometry updates must use `editor.run(fn, { history: 'ignore' })` (or the pinned SDK equivalent) and must not mark the study dirty.
- Keep files small and focused; one component/util per file where reasonable. Named exports.
- Scripts: `yarn dev`, `yarn build`, `yarn typecheck`, `yarn test`, `yarn lint`, `yarn import:bible`, `yarn dist`.

## Milestone status

Track progress in `docs/STATUS.md` (each agent appends what it finished, what is stubbed, and open issues).
