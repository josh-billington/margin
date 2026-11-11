# Library and study persistence (SPEC §3, §6.3, §8, M1)

## What exists

- **Library folder** (`src/main/library/library.ts`): default `~/Documents/Margin`, changeable through
  `library.chooseLibraryFolder`. Study files live in `studies/<ULID>.study.json`. `library.json` is a
  rebuildable index: `list()` regenerates it from validated study files when it is missing or stale.
- **Envelope and migrations** (`src/shared/study/migrations.ts`, `versioning.ts`, `validation.ts`):
  zod envelope from SPEC §8.1 with an app-owned migration map (version 1 today). A newer
  `schemaVersion` throws `UnsupportedStudyVersion(requiredVersion)`; the file is never rewritten.
  `validateDocument` checks record shape, exactly one page, page tag metadata, binding targets, and
  highlight ranges before a file is indexed or shown.
- **Atomic writes** (`src/main/library/atomic.ts`): temp file in the destination directory,
  `fsync`, `rename`, then directory `fsync`.
- **Save queue and conflicts** (`library.ts` `save`, `stage`, `conflict`):
  - Per-study serialized queue. Each renderer save carries a sequence number; stale sequences are
    dropped, so an older queued snapshot never overwrites a newer one.
  - Before replacing, the disk file is read and compared with the last known hash and revision, plus
    the renderer's base hash. A mismatch becomes a conflict: the local document is saved as a new
    study `"<title> (conflict copy)"` and the external original is kept.
  - Revision and `updatedAt` advance only when a document or title change is written. Identical
    saves are no-ops.
- **Recovery versions** (`library.ts` `recover`, `recoverThrottled`): the previous on-disk version is
  written under `<appData>/recovery/<id>/`. Ordinary autosaves snapshot at most once per 5 minutes per
  study; the first save after opening a study always snapshots. Conflicts, external reloads, and
  deletes always snapshot. The latest 20 are kept, so they cover roughly 100 minutes of editing. `open()`
  surfaces a newer valid recovery version as a `recovery` event; corrupt recovery files are ignored.
- **Watcher** (chokidar on `studies/`): own writes are recognized by revision and content hash.
  External changes map to SPEC §8.4: clean reload (`reload`), dirty conflict (`conflict`), invalid
  file (`error`, memory kept), deletion (`deleted`, memory kept, no silent recreate).
- **Single writer** (`lock.ts`): `.margin-lock` with pid, hostname, and `acquiredAt`. A live owner on
  the same host makes the library read-only. A dead same-host pid is reclaimed automatically. A lock
  held by another host makes the library read-only and surfaces a `lock` notice (`host`, `since`).
  `library.takeOver` replaces that lock; it refuses same-host owners.
- **App data** (`src/main/appData/store.ts`): `prefs.json` in `app.getPath('userData')` holds the
  selected library path, preferences, and per-study cameras. Updates are serialized and atomic.
- **IPC** (`src/main/ipc/persistence.ts`): replaces the `NOT_IMPLEMENTED` handlers for `library`,
  `prefs`, and `camera`. Flush on quit: main asks the renderer to flush (`margin:library:request-flush`),
  waits up to 15 s for the reply, then flushes the library and quits. A failed flush keeps the app open.
- **Renderer session** (`src/renderer/src/study/`):
  - `state.ts`: zustand store (sessions, save state, library list, read-only flag).
  - `session.ts`: open, create, save, rename, delete, save-copy, library events, flush-before-close.
  - `editor.ts`: attaches each study's tldraw editor, loads its snapshot, restores its camera, and
    listens only to `{ source: 'user', scope: 'document' }` changes.
  - `autosave.ts`: 500 ms debounce, 2 s maximum wait, one in-flight write at a time.
  - `history.ts`: caps undo at 1,000 committed document transactions per study. See open issues.
  - `StudyWorkspace.tsx`: keeps one `MarginCanvas`/editor per opened study mounted, hidden when
    inactive, so undo history survives study switches within the session.
- **Shell** (`src/renderer/src/app/`): Sidebar study list (open, rename, delete with a Radix
  AlertDialog), "My library" folder switch, Create study, empty library state, empty study state
  (`Amos 1:3-5`, note hint), SaveIndicator with Retry and Save a copy, sonner notices for reloads,
  conflicts, deletions, recovery, and read-only libraries. `LibraryLockNotice` is a persistent banner
  for a library locked by another computer, with a Radix AlertDialog that confirms "Take over".
- **Preferences**: `prefs.get`/`prefs.set` back the insertion dialog's translation choice through the
  `usePrefs` hook (`renderer/src/lib/usePrefs.ts`). The choice persists as `defaultTranslation` (KJV
  until prefs load). `oldTestamentTranslation` is stored but not yet used by reference resolution.

## Integration points for the canvas

1. **Custom shapes must be registered before any study loads.** `studySnapshot` runs
   `editor.store.schema.migrateStoreSnapshot` and `validateRecord` on each study. Passage and note
   `shapeUtils` (and any binding utils) must be passed to the `<Tldraw>` in `MarginCanvas.tsx`.
   Otherwise every study with a passage fails to open with a migration error.
2. **`MarginCanvas` contract.** `StudyWorkspace` mounts one `MarginCanvas` per study and calls
   `onMount(editor)`. The canvas must keep that prop, and it must not swap the editor. Session code
   calls `getSnapshot(editor.store).document` (via `snapshot(editor)` in `editor.ts`) and
   `loadSnapshot` for reloads. Those are the only canvas hooks used.
3. **Derived geometry must not dirty the study.** Arrow layout or other derived updates must use
   `editor.run(fn, { history: 'ignore' })` (or the SDK equivalent). Only `source: 'user'` document
   changes schedule a save.
4. **Page metadata.** New studies get `page.meta = { schemaVersion: 1, tags: [] }`. Tag edits must
   write to the page `meta` through the editor so they are saved and undoable.
5. **Focus and selection.** Selection is cleared on reload. Reading focus must not create document
   transactions.

## Verification

- `yarn typecheck`, `yarn lint`, `yarn test` (89 tests), and `yarn build` pass.
- Library tests use temp directories and cover: disk-write failure (no revision advance, no file
  replacement, retry works), flush and close waiting for queued saves, stale queued-snapshot
  ordering, identical-save no-op, malformed and unsupported files left untouched and excluded from
  the index, file/ID mismatch, valid external replacement, invalid replacement (memory kept, next
  save blocked), external deletion (memory kept, no recreate), dirty conflict copy, same-revision
  content conflict, stale renderer baseline, index rebuild from stale or missing `library.json`,
  20-version recovery retention, newer recovery on open with corrupt recovery ignored, read-only
  open under a live lock, real atomic-replacement watcher events, the 5-minute recovery throttle
  (forced snapshots before reload and conflict, and on the first save after open), and lock notice,
  takeover, refusal of a live same-host lock, and dead same-host lock reclaim.
- Renderer tests cover autosave timing and failure retry, flush-before-close ordering, failed-close
  recovery, cross-study session retention, dirty reload vs. clean reload, deleted and invalid
  external files, and history limits and reset.
- `main/appData` tests cover concurrent preference and camera updates.

## Open issues and deviations

- **Runtime not checked in Electron.** Launching the app would create `~/Documents/Margin` in the
  real home directory, so it was not run here. The first `yarn dev` run should check first-launch
  library creation, the Create study flow, and the save indicator.
- **1,000-transaction undo cap does not bound memory (blocker).** `history.ts` wraps the editor's undo,
  redo, and clear methods so undo stops after 1,000 committed transactions. tldraw 5.6.0's
  `HistoryManager` keeps its undo stack as an immutable linked list in a private `stacks` atom, and
  `history` is `protected` on `Editor`. The only public stack call, `squashToMark`, merges entries
  *newer* than a mark into one diff, so it cannot drop the oldest entries. Bounding memory would mean
  writing to private stacks, which is not a supported API. Keep the wrapper and revisit when tldraw
  exposes a history limit. The test `never asks the SDK to undo past the cap` pins the wrapper.
- **Conflict handling is intentionally conservative.** Local edits are preserved as copies, not
  merged. External writers that replace a file between the disk read and the rename are not
  detected by the watcher. The read-compare-replace sequence narrows that window, but no
  cross-process transaction exists.
- **Recovery versions are throttled, not per save.** SPEC §8.3 asks for the previous version before
  each replacement. The 5-minute throttle is a deliberate deviation so the 20-version window covers
  about 100 minutes of editing instead of a few minutes of autosave. Intermediate versions between
  snapshots are not kept. The study file itself is still written on every successful save.
- **Library lock is advisory.** A lock from another host is treated as live until someone takes it over.
  The takeover is confirmed in the UI, but Margin cannot prove the other computer has stopped writing.
- **Not implemented here:** study creation from templates, tag catalog UI, passage insertion,
  Bible-backed snapshot validation (the study loader only checks the envelope, document structure,
  and registered SDK schema).
