# Focus, camera, accessibility (M4) — 2026-11-02

- `canvas/focus/`: pure `camera.ts` (22px readable floor, fit/center/start alignment, 10–400% limits,
  verse-bounds estimate, pointer zoom), `dimming.ts` (bright set, no propagation), `pullOut.ts`
  (1.4x block, clipped highlights with fresh IDs, `pulledFrom`), `passageOrder.ts` (scripture order).
  All unit-tested. `store.ts` (zustand, per-editor, never in props/history), `actions.ts`
  (focus/step/exit/pull-out, 280ms ease-out or immediate under reduced motion), `shortcuts.ts`
  (F, ⇧F, ↑/↓, Esc ladder, ⌘0/⌘1/⌘2), `FocusLayer.tsx` (OnTheCanvas: scoped runtime stylesheet for
  dimming + derived pull-out connectors; wheel/pointerdown interrupt camera moves).
- UI: header double-click, verse-number click (in focus), Radix "Passage actions" menu with
  Focus passage / Focus verse / Pull out verse submenus (work with verse numbers hidden),
  sidebar passage list in scripture order.
- Leftovers: annotation validation re-runs after external reload; `oldTestamentTranslation`
  threaded through `resolveReference` (unqualified OT references only). Stored default changed
  from `jps1917` to `kjv` so KJV stays the default.
- Not verified live: the sandbox window stayed hidden (no rAF), so tldraw did not render. Camera/dimming
  were verified through pure tests only. Dim level is `--focus-dim-opacity` (0.22).
- Gaps: no Settings UI for the OT translation; canvas DOM order is still z-order (the sidebar list is
  the scripture-ordered access path); pull-out connector uses length-proportional verse position.
