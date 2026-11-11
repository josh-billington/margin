# Annotation editing (M3) — 2026-11-02

## Implemented

- **Tags** (`app/TagsSection.tsx`, `canvas/tags/`): sidebar list with highlight-range counts; create, rename, recolor
  (§2.1 palette), delete (reassign or remove highlights, one undo transaction); optional starter set (never auto-applied).
  Selecting a tag emphasizes matches (underline + tint, static under `prefers-reduced-motion`) with prev/next that pans.
- **Keyboard tagging**: Tag selection in toolbar, command palette and `⇧⌘H`; ⌥+text drag; ←/→ (Shift extends) selects
  whole words inside a focused passage; focused highlighted words open change/remove (Enter) or remove (Delete).
  Passage `aria-description` and word labels expose tag names.
- **Note options** (`canvas/shapes/note/NoteOptions.tsx`): size, color, font, rotation −6…+6° (Radix Slider, native radians,
  rotate handle hidden), `*emphasis*`, Keep with passage (+verse). Settings dialog: plain-font default for new notes and
  display-only plain-font option, stored via the existing prefs IPC.
- **Duplicate / delete / paste** (`canvas/annotations/`): ⌘D, one confirmation for passage deletes, cascade for incident
  arrows and associations (also for cut and every other `deleteShapes` path), tag import on paste (copy payload carries
  `marginTags`; name+color reuse, ID collisions never replace).
- **Shortcut priority** (`canvas/tools/shortcuts.ts`, `shortcutContext.ts`): popovers, text fields, note editing, IME and
  text selection register a synthetic tldraw open menu so canvas shortcuts stand down.
- **Load validation** (`shared/study/annotationValidation.ts`, `canvas/annotations/recovery.ts`): invalid highlights move to
  page meta `invalidAnnotations`; invalid word bindings are recorded and left untouched; sonner reports the count.

## Gaps

- Recovery move is derived (not marked dirty): it persists on the next save, otherwise the file is unchanged.
- Validation runs when an editor mounts; externally reloaded documents are not re-validated.
- Sidebar tag UI, note options popover, and keyboard word selection were verified by typecheck only, not driven live.
  Duplicate/delete/undo/paste import were driven live against the editor.
