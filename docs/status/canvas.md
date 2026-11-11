# Canvas M0 — 2026-11-02

Implemented on `t3/canvas-m0`, in the existing canvas worktree. No shared domain,
Bible provider, persistence, package, main-process, or preload changes.

## Implementation

- Registered `passage` and `margin-note` ShapeUtils with SDK prop validators
  backed by shared Zod schemas and initial custom-prop migration sequences.
  The additional `h` / `w` fields are cached layout geometry, never word identity.
- Passages render immutable PassageText snapshots as selectable DOM, with full
  passage/verse/token data attributes, Nunito Sans 28px × fontScale / 1.55,
  Cal Sans 18px draggable headers, 720 default width, and two horizontal resize
  edges (240 minimum). Options cover flow / verse-per-line, verse numbers,
  supplied-word italics, and font scale. DOM height and word anchors reconcile
  after font readiness, ResizeObserver notifications, and prop changes.
- H / Highlight supports whole-word dragging across verses, preview, and a Radix
  tag popover. Select-mode dragging preserves native text selection. An unmodified
  click on a highlighted range opens change/remove actions; Enter does the same
  on focused highlighted words. Tag names appear on hover and keyboard focus.
  Tag creation and range application share one history transaction; tags live
  in page meta. Replacement splits prefixes/suffixes and merges adjacent tags.
- Notes support T / toolbar / empty-canvas double-click, textarea editing,
  handwritten / plain font, S/M/L/XL sizes, Ink / palette colors, automatic width
  and height growth, and drag-to-create / resize for fixed wrapping width.
- `MarginArrowShapeUtil` subclasses the built-in ArrowShapeUtil. The SDK's own
  ArrowBindingUtil remains registered. Terminal handle dragging resolves actual
  word DOM and writes `{schemaVersion:1,target:{verse,token}}` in binding meta,
  `isPrecise:true`, `isExact:true`, `snap:'none'`, and a normalized anchor just
  outside the word (5px × arrow scale above or below it, on the side the arc
  arrives from; never a side edge). The exact flag keeps tldraw from clipping to
  the block boundary. `installWordTerminals` re-derives that anchor when either
  end, the bend, or a bound block moves, from word boxes cached per layout. Notes retain ordinary SDK binding behavior. Word hover has a temporary
  underline. X reverses a selected arrow's bend outside text/popover editing.
- Word reconciliation rounds anchors to 1e-4, skips identical writes, batches
  bindings, and retains last geometry when DOM is culled. It reconciles on return.
  Derived writes use both `editor.run(..., {history:'ignore'})` and
  `store.mergeRemoteChanges(...)`. The latter marks their source as `remote`:
  **persistence must listen with `{scope:'document',source:'user'}`** to avoid
  derived-only dirty flags / autosave loops. A listener for all sources will see
  these records. User annotation edits remain normal document changes.
- Default UI stays hidden; canvas is Night. SDK dark-theme `white` solid/fill
  renders Ink. Arrows default to draw dash, 2.5px stroke, a filled triangle, and
  a gentle bend; bundled fonts and assets remain offline.
- Development toolbar commands insert Amos 1:3–5 (with supplied italics) and
  Psalm 119:1–16. M0 button / `window.marginCanvasDev.runM0Checks()` requires an
  empty study and leaves its demonstration document visible. This is an explicit
  development check, not automatic startup content.

## M0 acceptance evidence

1. **Pass:** precise word-bound arrow and nearby highlight. Live check verifies
   immutable word metadata, rounded anchor, and SDK-resolved rendered terminal
   within 0.5 canvas units of the DOM word center. A real Electron pointer drag
   also created an exact/precise binding to Amos 1:3 token 8 (Damascus).
2. **Pass:** resize moves the target onto a different line; anchor and rendered
   terminal still resolve to that word.
3. **Pass:** layout, font scale, supplied italics, and highlight weight changes
   preserve target and rendered terminal.
4. **Pass:** actual SDK culling is asserted; offscreen movement/resizing retains
   cached geometry, then returning to view reconciles it.
5. **Pass:** annotation and each layout change undo/redo preserve word identity;
   annotation undo also restores the page tag catalog.
6. **Integration pending:** closing and reopening from disk belongs to persistence.
   SDK `getSnapshot` → JSON → `loadSnapshot` round-trip passes in Vitest and the
   live check, preserving full PassageText, edition versions, highlights, tags,
   and binding metadata. This is not a disk-save/restart claim.
7. **Snapshot behavior established; corpus integration pending:** passages render
   their own stored text and never consult/replace it from the current corpus.
   Round-trip preserves the full old edition snapshot. Actual newer-corpus app
   upgrade acceptance awaits the Bible provider and persistence integration.

The live check proves zero undo entries and zero document/source:user listener
calls for derived geometry (including subsequent DOM reconciliation). Native
Electron input checks also verified text selection without passage movement,
highlight drag/popover/create/apply, note creation/editing and multiline growth.

## Verification and limitations

- `yarn typecheck`, `yarn lint`, `yarn test` (8 tests), and `yarn build` pass.
  Range tests include SPEC §4.4 Place 1–8 / Person 3–5, adjacency, replacement
  across ranges, removal, reverse drag, and cross-verse identity.
- Live M0 checks passed in the actual Electron dev app using its local debugger.
  A hidden-window environment initially paused requestAnimationFrame; explicitly
  showing the test window resumed it. No application code workaround was added.
- Initial migrations are empty because this introduces schema version 1. Recovery
  reporting for invalid loaded annotations and future migrations belongs to the
  study loader. Shape prop validation alone does not validate targets against text.
- Visual gap versus SPEC §2.3: draw stroke is deterministic SDK rendering and
  2.5px nominal thickness with rounded caps. The native triangle uses the SDK's
  length-dependent head sizing (capped at 3× stroke, roughly 7.5px before triangle
  projection), shorter than the requested approximately 14px head. Matching that
  independently would require custom arrowhead rendering; no unsupported SDK
  internals or custom BindingUtil were needed for durable word targeting.
- No packaged/signed distribution or licensed offline production verification.
  The existing tldraw license/watermark release prerequisite remains open.
- Focus, full tag management/sidebar counts, cross-study copy, and deletion
  workflows remain later milestones. Fixture tokenization is development-only.
