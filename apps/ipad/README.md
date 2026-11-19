# iPad host

Capacitor 8 / Swift Package Manager shell for the **unmodified** `packages/core` renderer.
`com.margin.ipad` is a placeholder bundle ID. Requires pnpm 11, Xcode 26.3, the root
`.env` containing `VITE_TLDRAW_LICENSE_KEY`, and the ignored Bible and lexicon SQLite
files in `apps/desktop/resources/{bible,lexicon}/`.

```sh
pnpm install
pnpm --filter @margin/ipad build
pnpm --filter @margin/ipad ios:sync
pnpm --filter @margin/ipad ios:run
```

`ios:run` targets the review machine's iPad Pro 11-inch (M5) simulator. For a different
device, run `pnpm --filter @margin/ipad exec cap run ios --no-sync --target <simulator-uuid>`
after `ios:sync`. These scripts are Nx-inferred targets; native sync/run are not cached.

The Vite config reuses the prototype's HTML-entry interception, but has its own plain
React/Tailwind configuration, without Electron. Build copies the ignored corpora into
`www/assets/databases/` using the SQLite plugin's `SQLite.db` suffix. The plugin copies
them to Library before opening **read-only** connections. Bridge row metadata is removed
and byte arrays become `Uint8Array`; services still receive unknown rows and own domain
validation. Nothing fetches scripture over the network.

Always run `capacitor/vendor-spm.sh` after **every** `cap sync`. Xcode's binary artifact
downloads hang on this machine. The prototype's checksum-verified Capacitor 8.6.2 curl
workaround is extended to SQLCipher 4.20.0 (the SQLite plugin's transitive binary).
All frameworks are ignored. The generated SPM manifest references these local packages;
run `ios:sync` before opening the project on a fresh checkout.

## Files and lifecycle

- Studies: Documents/`Margin`. Preferences, recovery data and install ID: Library/`Margin`.
- Writes use Filesystem to write a sibling temp file, run `beforeReplace`, then call a
  tiny native POSIX rename bridge. Filesystem 8.1.5's own rename **deletes** an existing
  destination before moving, so it cannot provide atomic replacement. The native bridge
  only accepts sibling temp files inside the app's Documents/Library sandbox.
- App background events request the renderer's existing flush listener. A native iOS
  background task gives that asynchronous flush time to finish; it ends on completion or
  system expiration. This cannot protect against force-killing an app before any save.
- Appearance resolves stored preferences against `prefers-color-scheme` and follows
  changes. There is no glass, native menu, native context menu, or folder picker.

## P8 boundaries

There is one app scene and no external writer. FileWatch is intentionally a no-op;
P8 replaces it when introducing external libraries/sync. Filesystem has no exclusive
create primitive, so `createExclusive` serializes check-and-write inside this sole host;
it is **not** a cross-process or shared-folder lock.

Lock owners allow an **absent** pid rather than pretending iOS has a meaningful process
ID. The persisted install UUID is the hostname/owner identity. Only that install is
considered alive. On startup the single-scene host removes its own previous-process lock;
it never removes another install's lock. P8 must redesign this before external sharing
or multiple scenes. Existing desktop pid locks and their behavior are unchanged.

## Simulator review probe

```sh
MARGIN_IPAD_PROBE=1 pnpm --filter @margin/ipad ios:sync
```

The probe is dynamically imported only when this explicit **build-time** flag is set.
Default production web builds contain neither the probe nor its renderer-store imports.
It never evaluates JavaScript or weakens the CSP.

In the simulator's data container, write Library/`MarginReview/command.json` with a
unique `id` and an `operation`, for example:

```json
{ "id": "add-john", "operation": { "kind": "add", "reference": "John 3:16" } }
```

Results appear as `result-<id>.json` beside the command. Operations: `status`, `add`,
`lookup` (Genesis 1:1 / created), `note` / `edit` (`text`), `translation` (`target`),
`fit` (camera zoom-to-fit) and `performance` (ten Psalm 119 adapter fetches).
`first-paint.json` records the first verse DOM painted across two animation frames;
compare its epoch with the time immediately before `simctl launch` for end-to-end launch.
This is a diagnostic probe, not a substitute for touch/Pencil/hardware validation.
