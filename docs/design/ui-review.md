# UI review: system font, compact density, verse/chapter copy, Liquid Glass

Status: review only, no source changed. Lens: Emil Kowalski's design-engineering principles plus macOS-native conventions.
Reviewed: `src/renderer/src/{App.tsx,main.tsx,app/*,canvas/*,insertion/*,styles/*}`, `src/main/index.ts`, `src/preload/index.ts`, `electron-liquid-glass@1.1.1` (README, `dist/index.d.ts`, `src/glass_effect.mm`, `package.json`). The app was not run for this pass (no screenshots). Verify every visual number below in the running app before merging.

These product-owner directives override SPEC §2.2 and parts of §2. Update SPEC §2/§3 and ARCHITECTURE (fonts line 20) in the same PR as the type change.

## Priority order

| # | Change | Risk | Section |
| --- | --- | --- | --- |
| P0 | System font tokens, delete Nunito Sans and Cal Sans | Low | 1 |
| P0 | Copy: passage becomes verse/chapter | Low | 3 |
| P0 | Remove uppercase and tracked caps | Trivial | 4 |
| P1 | Compact density scale | Medium (many CSS edits) | 2 |
| P1 | Motion and interaction polish | Low | 5 |
| P1 | Entry-point refactor (do before or with glass) | Medium | 7 |
| P2 | Liquid Glass | Medium (private API, window flags) | 6 |

Order matters: do 7 (shell extraction) first or alongside 2, because 2 and 6 both restructure the same layout CSS.

---

## 1. Typography tokens (system font)

### Findings

- Fonts are hardcoded in about 10 places, not just tokens: `styles/shell.css` (body, `.title-bar h1`, `.sidebar-footer`, `.empty-state h2`, `.tl-container --tl-font-sans`), `styles/index.css` (`--font-sans`, `--font-heading`), `canvas/canvas.css:9,23,71,163`, `insertion` styles (`.insert-title`), `NoteComponent.tsx:72-75`, `styles/fonts.css`, plus `@fontsource/nunito-sans` in `package.json`.
- Cal Sans is used for four different roles (window title, sidebar wordmark, empty-state headline, dialog title, passage header). Under the system font these all become one family with weight and size as the only hierarchy.
- Remove the `fonts.ready` waits only if profiling shows no remeasure is needed. They are harmless for Gochi Hand, so keep them for notes.

### Tokens (replace `tokens.css` additions and `@theme inline` entries)

```css
:root {
  --font-ui: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
  --font-hand: 'Gochi Hand', 'Bradley Hand', cursive; /* handwritten notes only */

  --text-2xs: 10px;  /* kbd keycaps, badges */
  --text-xs: 11px;   /* secondary labels, hints, tooltips, kbd, group headings */
  --text-sm: 12px;   /* default chrome: buttons, rows, inputs, popovers */
  --text-md: 13px;   /* sidebar rows, dialog body, window title (macOS-standard) */
  --text-lg: 15px;   /* dialog titles */
  --text-xl: 22px;   /* empty-state headline */
}
html { font: 400 var(--text-sm)/1.4 var(--font-ui); -webkit-font-smoothing: antialiased; font-optical-sizing: auto; }
```

Rules:

- `-apple-system` resolves to SF Pro and picks Text/Display optical sizes automatically. Do not name `SF Pro Display` explicitly for large text unless you see tracking issues. Delete `--font-display` if unused.
- Antialiasing: the app is dark UI on macOS, so `-webkit-font-smoothing: antialiased` avoids the heavy look of subpixel-weight text on dark backgrounds.
- Use `font-variant-numeric: tabular-nums` on anything that changes: zoom %, match counts ("2 of 7"), tag counts, rotation degrees.
- Weights: 400 body, 500 buttons and labels, 600 headings and titles. Drop 700/800 everywhere in chrome (`.text-button` 700, `.primary-button` 800, `.library-label` 700). SF at 700+ looks shouty at 12px.
- Do not use letter-spacing anywhere in chrome. `-apple-system` already tracks by size.

### Role table (replaces SPEC §2.2)

| Role | Font | Size | Weight | Line height | Notes |
| --- | --- | --- | --- | --- | --- |
| Scripture | system | 26px at 100% zoom (spec said 28px Nunito) | 400 | 1.5 | SF has a larger x-height than Nunito Sans, so the same px reads bigger. Try 26 and 24, pick by eye at 720-unit block width. Keep `fontScale` multiplier (`PassageComponent.tsx:217` uses `28 * fontScale`; extract `SCRIPTURE_BASE_PX`). |
| Highlighted words | system | same | 600 (spec said 700) | same | 600 keeps reflow shift small. Tag color unchanged. Check reflow: bold changes widths, but anchors are word-ID based so only layout is affected. |
| Verse numbers | system | 0.55em superscript | 500 | 0 | Muted. `font-variant-numeric: tabular-nums`. |
| Chapter/verse reference header | system | 13px | 600 | 1.3 | Sentence case, muted, ink when focused. No letter-spacing. Replaces Cal Sans 18px (`canvas.css:9-17`). |
| Study title (title bar) | system | 13px | 600 | 1.3 | Matches macOS window titles. Centered in the title bar is the native pattern, see section 2. |
| Notes, handwritten | Gochi Hand | 22px base (S18/M22/L28/XL36 unchanged) | 400 | 1.35 | Only place a non-system font appears. |
| Notes, plain | system | 22px base (consider 20px, since SF is larger than Nunito) | 400 | 1.35 | `NoteComponent.tsx:75` fallback becomes `var(--font-ui)`. |
| Chrome default | system | 12px | 400/500 | 1.4 | Buttons, inputs, rows, popovers. |
| Chrome secondary | system | 11px | 400 | 1.4 | Hints, counts, kbd, tooltips, group headings. |
| Dialog title | system | 15px | 600 | 1.3 | |
| Empty-state headline | system | 22px | 600 | 1.2 | Was `clamp(28px,3vw,38px)` Cal Sans. Tight, native. |
| Sidebar wordmark footer | none | n/a | n/a | n/a | Delete `.sidebar-footer` ("Margin / A little room to study."). It is decoration that only existed to show Cal Sans. If branding is wanted, use 11px muted "Margin" with no tagline. |

### Concrete edits

| File | Change |
| --- | --- |
| `styles/fonts.css` | Delete Nunito and Cal Sans imports/@font-face. Keep only `@fontsource/gochi-hand/latin-400.css`. |
| `package.json` | Remove `@fontsource/nunito-sans`. `resources/fonts/cal-sans` and `resources/fonts/nunito-sans` can be deleted (OFL files are only needed while shipping the fonts). Keep `gochi-hand` and tldraw's font notices if tldraw still ships Shantell/IBM Plex for any shape. `extraResources` copies all of `resources/`, so removal shrinks the bundle. |
| `styles/index.css` | `--font-sans` → `var(--font-ui)`, drop `--font-heading`, add `--font-hand`. |
| `styles/shell.css` | `body { font-family: var(--font-ui) }` and remove every `font-family: 'Cal Sans'…` (`.title-bar h1`, `.sidebar-footer`, `.empty-state h2`). `.margin-canvas .tl-container --tl-font-sans: var(--font-ui)`. |
| `canvas/canvas.css` | `.passage-header` font → `600 13px/1.3 var(--font-ui)`, remove `letter-spacing`. `.passage-text` → `var(--font-ui)`. `.margin-popover` and tag-name `::after` → `var(--font-ui)` sizes from tokens. |
| `insertion` `.insert-title` (in `shell.css`) | `600 15px/1.3 var(--font-ui)`. |
| `NoteComponent.tsx:72-75` | Handwritten: `var(--font-hand)`. Else `var(--font-ui)`. |
| `docs/SPEC.md §2.2`, `ARCHITECTURE.md:20` | Update to the table above. |

Note for tldraw: `editor.updateThemes` in `MarginCanvas.tsx` already controls colors. Confirm tldraw's `tl-font-*` variables are not used by any visible text (UI is hidden via `hideUi`), so only the container variable above matters.

---

## 2. Spacing and size scale (compact macOS density)

### Findings (current → problem)

| Where | Now | Problem |
| --- | --- | --- |
| `.title-bar` | 68px tall, left pad 88px, 24px Cal Sans title | Roughly 1.6x a native unified toolbar. The traffic lights are inset (`hiddenInset`) so a 52px bar still clears them. |
| `.icon-button` | 36×36, radius 6, icons 17–20px | Native toolbar buttons are about 28px with 15–16px SF-Symbol-weight icons. |
| `.canvas-toolbar` | 6px padding, 50px zoom button, 10px radius, `bottom: 28px` | Large floating bar competing with scripture. |
| `.sidebar` | 236px wide, padding 26/20, section gap 36px, `.library-label` margin-bottom 36px | Roomy. Native sidebar rows are 24–28px tall and 8–10px horizontal padding. |
| `.primary-button` | padding 11/17, weight 800 | About 40px tall. Native default button is 22–28px tall. |
| `.margin-popover` | padding 16, inputs padding 5, buttons padding 5 | Inputs about 26px, uneven with buttons. Gap 10px. |
| `.command-dialog` | 540px, search padding 18, items padding 11/10, icons 17–18px | About 40px result rows. Spotlight-style rows are 28–32px. |
| `.insert-dialog` | padding 18, input padding 9/11, gap 14 | OK structure, oversized. |
| `.dialog-panel`, `.library-dialog` | padding 24, two different implementations | Duplicate dialog CSS (also `.library-dialog` has no border and `#0009` overlay while others use `--focus-dim`). Unify. |
| `lucide-react` icons | size 15–20 mixed, default stroke 2 | Heavy next to 12px type. Use size 14–16, `strokeWidth={1.75}` consistently. |

### New scale tokens

```css
:root {
  --space-1: 2px;  --space-2: 4px;  --space-3: 6px;  --space-4: 8px;
  --space-5: 12px; --space-6: 16px; --space-7: 24px;

  --control-h-sm: 22px;  /* inputs inside popovers, segmented controls, text buttons */
  --control-h: 26px;     /* toolbar/title-bar icon buttons, sidebar rows, dialog buttons */
  --control-h-lg: 30px;  /* primary CTA only */
  --icon: 15px;          /* lucide, strokeWidth 1.75 */
  --icon-sm: 13px;

  --radius-sm: 6px;      /* buttons, rows, inputs */
  --radius-md: 10px;     /* popovers, toolbar */
  --radius-lg: 14px;     /* dialogs, command palette (macOS 26 favors larger, concentric radii) */
}
```

Concentric radii rule (macOS 26): outer radius = inner radius + padding. Toolbar: buttons radius 7px, padding 4px, toolbar radius 11px. Do not pick a radius independently of the contained elements.

### Target values

| Surface | Target |
| --- | --- |
| Title bar | height 52px; `trafficLightPosition: { x: 18, y: 18 }` in `BrowserWindow` so the lights are vertically centered; left padding 78px when sidebar is closed. Study title 13px/600 centered or left, 26px field height. Actions 26px buttons, 16px icons, gap 4px. |
| Sidebar | width 220px (200 at the `max-width: 950px` query), padding 8px, sections gap 16px. Rows 26px tall, 8px horizontal padding, radius 6px, hover `rgba(255,255,255,0.06)`, selected `var(--sky-tint)`. Delete (×) and rename buttons are hover-revealed 22px icon buttons (use `lucide X` and `Pencil` with `aria-label`s), not text buttons. |
| Toolbar | `bottom: 20px`, padding 4px, gap 2px, buttons 28×28 (icons 16px), zoom button width 44px/11px tabular. Divider height 16px. Radius 12px. |
| Tooltip | 11px, padding 4px 8px, radius 6px, no arrow (native tooltips have none; drops `Tooltip.Arrow`), `sideOffset` 6. |
| Popover | padding 10px, gap 8px, min 220/max 280px, radius 10px, inputs and selects `--control-h-sm` (22px) with 12px text, buttons 22px, 12px text. Section labels 11px muted (no caps). |
| Command palette | width 520px, search row 40px, input 15px, results rows 28px with 14px icons, group headings 11px/500 muted (cmdk sets these; the style is at `[cmdk-group-heading]`). Selected row: `--sky-tint`, drop the 1px accent outline (it reads as a web focus ring). |
| Insert dialog | padding 14px, input height 28px, translation segmented control height 28px, actions 26px buttons. |
| Dialogs (`.dialog-panel`, `.library-dialog`) | One class `.dialog-panel`: padding 16px, radius 14px, max 380px, buttons 26px, title 15px/600. Delete `.library-dialog*` and use `.dialog-panel`/`.dialog-overlay` in `Sidebar.tsx` and `LibraryLockNotice.tsx`. |
| Primary button | 26px tall, padding 0 12px, 12px/600, radius 6px, accent fill, ink text (dark text on #00A2FF fails the 4.5:1 test with white; `--night` on Sky is 6.8:1, so keep `--night` text). |
| Empty state | headline 22px/600, body 13px muted, hints 11px, gap 8–12px. |
| Save indicator | 11px muted, icon 12px, remove `margin-right: 16px`. |
| Focus ring | `outline: 2px solid var(--accent); outline-offset: 2px`. Offset 3px is too loose at 26px controls. |

Hit area rule: keep a 28px minimum interactive area for small controls, via padding or `::before { inset: -3px }`, even when the visible control is 22px. Compact does not mean fiddly.

---

## 3. Copy: remove "passage"

Rule: a block that holds a whole chapter (or chapters) is a **chapter**; otherwise it is **verse** (single) or **verses** (range, including ranges that cross a chapter boundary). Generic contexts with no specific block use **verses**.

Implement as one helper, `blockNoun(ranges): 'verse' | 'verses' | 'chapter' | 'chapters'` in `insertion/labels.ts` (needs the versification chapter verse count from `@shared/bible/versification`). "Whole chapter" means a range from verse 1 to the chapter's last verse. All UI strings below take the noun from this helper. Identifiers stay as they are: shape type `'passage'`, `PassageRange`, `data-passage-id`, `get-passage` IPC channel, `insert passage` history marker, files under `shapes/passage/`. Renaming persisted types would break the data contract. Only user-facing strings change. Rename the `shapes/passage/` directory later, if at all, as a separate no-behavior-change refactor.

### Copy table

| Location | Old | New |
| --- | --- | --- |
| `Toolbar.tsx:71` tooltip/aria | Add passage | Add verses |
| `Toolbar.tsx:90,98` (dev only) | Insert fixture passage / Insert long fixture passage | Insert fixture verses / Insert long fixture chapter |
| `CommandPalette.tsx:50` placeholder | A passage, a study, a thought… | Search verses, studies, commands… |
| `CommandPalette.tsx:57-63` typed item | Add passage `<typed>` | Add `<typed>` (e.g. "Add Amos 1:3–5"). Keep `value` string internal. |
| `CommandPalette.tsx:67` item | Add passage… | Add verses… |
| `CommandPalette.tsx:41` sr-only description | Find a passage, navigate studies, or run a command. | Find verses, open a study, or run a command. |
| `CommandPalette.tsx` group headings | Study / Selection / Workspace | Keep (already sentence case) |
| `EmptyState.tsx:6` eyebrow | ROOM FOR A CLOSER LOOK | Delete the line (uppercase eyebrow, see section 4) |
| `EmptyState.tsx:7` headline | Begin with a passage. | Begin with a verse. |
| `EmptyState.tsx:15` button | Add passage | Add verses |
| `EmptyState.tsx:19` hint | Try Amos 1:3-5 with ⌘K | Try "Amos 1:3–5" in ⌘K. (use an en dash to match the canonical label) |
| `App.tsx:96` `onAddPassage` prop names | n/a | Rename props `onAddVerses` for consistency (internal) |
| `InsertPassageDialog.tsx:105` title | Add passage | Add verses |
| `InsertPassageDialog.tsx:107` sr-only description | Type a reference, review the resolved passage, then insert it. | Type a reference, check the resolved verses, then add them. |
| `InsertPassageDialog.tsx:21` idle hint | Try Amos 1:3–5, Romans 8:28–9:5, or KJV Joel 2:28. | Try Amos 1:3–5, Amos 1 for a chapter, or Romans 8:28–9:5. |
| `InsertPassageDialog.tsx:146` submit | Insert passage | Add `{blockNoun}` → "Add verses" / "Add verse" / "Add chapter" |
| `InsertPassageDialog.tsx:145` switched-translation submit | Use KJV and insert | Use KJV and add |
| `InsertPassageDialog.tsx:51` partial equivalence | (partial verses; confirm when switching) | (partial verses; confirm when switching). Fine, already uses "verses". |
| `shared/bible/reference.ts:74` notice | …KJV is offered for this New Testament passage; confirm KJV before inserting. | JPS 1917 covers the Tanakh only. KJV is offered for these New Testament `{verses/chapter}`; confirm KJV before adding. Needs the noun passed in or a neutral "this reference": "…KJV is offered for this New Testament reference…". Recommend "reference" here since the shared module has no block context. |
| `main/bible/provider.ts:76` | A passage endpoint does not exist in this edition. | That verse does not exist in this edition. |
| `main/bible/provider.ts:79` | A passage chapter does not exist in this edition. | That chapter does not exist in this edition. |
| `canvas/shapes/passage/PassageComponent.tsx:197-199` header fallback | Passage | Verses |
| `PassageComponent.tsx:154` resize handle aria | Resize passage {edge} edge | Resize {left/right} edge (drop the noun) |
| `PassageComponent.tsx:211` aria-label of text | Scripture. Arrow keys select words; Shift extends; then use Tag selection. | Keep (no "passage"). |
| `PassageOptions.tsx:35,46` trigger + content aria-label | Passage options | `{Verse/Verses/Chapter} options` using `blockNoun`. Trigger text `···` stays. |
| `NoteOptions.tsx:29` fallback label | Passage | Verses |
| `NoteOptions.tsx:113` label | Keep with passage | Keep with verses (use a fixed phrase because the control lists many blocks) |
| `NoteOptions.tsx:140` option | Whole passage | Whole `{block noun}`; for a chapter block "Whole chapter", for verse blocks "All verses" |
| `NoteOptions.tsx:116` option list text | `{label} · {KJV}` | Keep. |
| `DeleteConfirm.tsx:14` title | Delete this passage? / Delete these passages? | Delete this `{verse/verses/chapter}`? / Delete these blocks? Use the noun for one block; for multiple mixed blocks use "Delete these scripture blocks?" Recommend "Delete {n} scripture blocks?" for n > 1 to avoid mixed nouns. |
| `deletion.ts:57` impact | 1 passage | 1 verse block / 1 chapter block / n scripture blocks. Wording: "This removes 1 chapter, 3 notes, 2 highlights." If counts mix, "2 scripture blocks". |
| `deletion.ts:64` | N notes will stay, without a passage association. | N notes will stay, no longer kept with verses. |
| `recovery.ts:87` toast | N annotations no longer match their passage text (…) | N annotations no longer match their scripture text (H highlights, A arrow targets). They were kept in this study's recovery data and not moved to other words. |
| `shared/study/validation.ts:110` error | Highlight is outside its passage snapshot. | Highlight is outside its scripture snapshot. (Internal error, but may surface in logs.) |
| `canvas/highlights/ranges.ts:35` error | Range target is absent from passage snapshot | Range target is absent from scripture snapshot (internal) |
| `PassageOptions.tsx` / `NoteOptions.tsx` Layout options | Flow / Verse per line | Keep. Consistent with wording. |
| `commands.ts:11` history marker | insert passage | Internal. Keep as is (not user-visible). |
| `README`/`SPEC`/`STATUS` | "passage block" | Update SPEC §3 ("Add passage" toolbar entry), §4.1 title, and "Focus on a passage" phrasing to verses/chapter at the same time. SPEC is user-visible documentation for product copy. |

Also reviewed for other copy that is not about "passage" but should change with the sentence-case sweep: `Sidebar.tsx` "My library" is fine; `Sidebar.tsx:41` duplicate "Create study" (header "+" and a text button below) should collapse into the header "+" only; `ToolButton` tooltips use title case ("Open command palette") → sentence case ("Open command palette" is already fine). `Tag selection` toolbar button should read "Tag selected words" to match the popover `aria-label` (`TagPopover.tsx:76`).

---

## 4. Uppercase removals

Search result for `uppercase|text-transform|letter-spacing|toUpperCase` across `src/renderer` and `src/shared`:

| File:line | Now | Change |
| --- | --- | --- |
| `styles/shell.css:131-135` `.section-heading h2` | `font-size 11px; letter-spacing .09em; font-weight 800; text-transform: uppercase` | `font: 600 11px/1.3 var(--font-ui); text-transform: none; letter-spacing: 0`; color `--text-muted`. Text stays "Studies", "Tags" (source is already sentence case). |
| `styles/shell.css:192-195` `.empty-state .eyebrow` + `EmptyState.tsx:6` "ROOM FOR A CLOSER LOOK" (hardcoded caps in JSX) | 10px, `.18em` tracking, 800 weight | Delete the element and its CSS. No replacement line. |
| `canvas/canvas.css:12` `.passage-header` | `letter-spacing: 0.01em` | Remove. |
| `PassageComponent.tsx:199` | `translationId.toUpperCase()` shows "KJV", "JPS1917" | Use `translationNames[id].short` ("KJV", "JPS 1917"). Abbreviations are acronyms, so caps are correct here; this is not a decorative uppercase. The `toUpperCase()` of the raw id yields "JPS1917", which is wrong. |
| `NoteOptions.tsx:123` | same | same helper |
| `kbd` elements (`shell.css`) | 11px muted, no caps transform | Keep. Key glyphs (⌘K) are not text labels. |
| Hardcoded caps strings | "M0", "AMO", "PSA" (dev-only toolbar buttons in `Toolbar.tsx`) | Leave: dev only. Hide them behind a `DevTools` component (see section 7). |

Sentence-case audit of visible labels: all other labels are already sentence case. "Studies", "Tags", "Settings", "Layout", "Size", "Font", "Color" are fine. After this change `grep -rn "uppercase\|letter-spacing\|text-transform" src/renderer` should return nothing.

---

## 5. Motion and interaction polish (Emil principles)

Frequency first: command palette, sidebar toggle, tool switching, and tooltips are used dozens to hundreds of times a day. They should be instant or nearly so. Dialogs, popovers, and toasts are occasional and get short animation.

Add tokens:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}
```

The code currently has no transitions for dialogs, popovers, tooltips, or the sidebar (only `spin` and `tag-pulse`), and no `:active` state on any control. Everything pops in. Items:

| Before | After | Why |
| --- | --- | --- |
| No `:active` state on `.icon-button`, `.primary-button`, `.text-button`, `.margin-popover button` | `transition: transform 120ms var(--ease-out), background-color 120ms ease; &:active { transform: scale(0.96) }` (0.97 for large buttons) | Buttons must acknowledge presses. Gate with `:not(:disabled)`. |
| `.icon-button:hover` applies background with no transition | `transition: background-color 120ms ease, color 120ms ease` inside `@media (hover: hover) and (pointer: fine)` | Hover polish, avoids stuck hover on touch/trackpad drags. |
| Command palette (`⌘K`) has no motion (good) but the overlay `Dialog.Overlay` is instant | Open: overlay fade 120ms, panel `opacity 0→1; scale(0.98)→1` 150ms `--ease-out`, origin center (modal). Close: 100ms. Opened by keyboard 100+ times/day, so keep the entrance under 150ms, no translate, no bounce, and never animate the palette on close from the `⌘K` toggle. | Occasional-to-frequent, so minimal. Raycast-style instant is acceptable too; at minimum remove overlay delay. |
| Insert-verses dialog, settings, delete confirm, rename: instant | Enter 180ms `--ease-out`: `opacity 0, scale(0.96)` → 1, center origin. Exit 120ms (faster than enter). Use Radix `data-state="open|closed"` selectors plus `@starting-style`, no JS. | Occasional, so standard animation. Asymmetric timing. |
| Popovers (`.margin-popover`, tag popover, tag-create popover) are instant | `transform-origin: var(--radix-popover-content-transform-origin)`; open 140ms `scale(0.96)+opacity 0 → 1` `--ease-out`; close 100ms. | Popovers scale from their trigger, not center. Radix exposes this variable. Modals stay centered. |
| Tooltips (Radix, `delayDuration=350`) are instant and have an arrow | Keep 350ms delay but make `skipDelayDuration={0}`… set `Tooltip.Provider skipDelayDuration={300}`; first tooltip 125ms fade+`scale(0.97)`, subsequent ones `[data-instant]`/skip animation (Radix: `data-state="instant-open"` → `transition-duration: 0ms`). Remove the arrow. | Instant after the first makes the whole toolbar feel faster. |
| Sidebar toggle (`⌘\`, App.tsx:55): `sidebarOpen &&` unmount, instant | Keep it instant for keyboard toggles, and do not animate. If the button is clicked, a width transition would reflow the canvas continuously, so don't. Alternative with no layout cost: keep it mounted, `transform: translateX(-100%)` with `--ease-drawer` 220ms on click only. Recommendation: stay instant. The toggle is high-frequency and reflowing tldraw during an animation is expensive. | Frequency rule + performance. |
| Toolbar tool switching: pressed state is a color change only | `aria-pressed` background transition 120ms. No movement. | Keyboard-initiated (V/T/A/H) so must not feel delayed. |
| Save indicator state change swaps text/icon instantly (Saved ⇄ Saving) | Crossfade 150ms with 2px blur (`filter: blur(2px)` while swapping), and only show "Saving" after 400ms so fast saves don't flicker | Blur masks two overlapping states; debounce avoids flicker. Keep spinner `linear 1s` (constant motion) and the reduced-motion override already present. |
| Toasts (sonner) | Keep sonner defaults; set `theme="dark"` already; position `bottom-right` collides with the floating toolbar only at narrow widths, check at 760px min width. Use `offset={{ bottom: 72 }}` if overlapping. | Sonner already handles transitions and interruptibility. |
| Tag emphasis pulse (`canvas.css:182-190`): two duplicate keyframes `tag-pulse-a/b`, `1.1s ease-out` | Keep two names (they exist to restart the animation via class swap). Shorten to 600ms, `--ease-out`. | UI animations under 300ms is the rule, but this is a deliberate attention cue, so 600ms ok. Reduced-motion already static. |
| `tagFocus.ts:49` `centerOnPoint` 280ms | Fine. Already respects reduced motion. | |
| Canvas drag/resize (passage header drag, resize handles) | No transitions on `transform`/`width` while dragging. | Direct manipulation must track the pointer 1:1. |
| `prefers-reduced-motion` handled in two files only | Add a global block: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 1ms !important; animation-duration: 1ms !important } }`, plus keep opacity fades. Better: reduce, don't delete: keep opacity fade, remove scale/translate. | Fewer and gentler, not zero. |
| `transition: all` | None found today. Add a lint rule (stylelint `declaration-property-value-disallowed-list`) once transitions land. | Prevent regression. |

Interaction polish beyond animation:

- Drag region: `.title-bar` is `-webkit-app-region: drag`. Make sure the rename `<input>` and all buttons are `no-drag` (only `.title-bar button` and `.title-bar input` are covered). Double-clicking the title bar must keep the native zoom behavior. Check `h1` (inside drag region but contains the input) behaves.
- Title input: replace the raw `<input>` with a "label that becomes an input on click" so the title looks like a native window title. Commit on blur or Enter, revert on Escape (currently Escape does nothing). `TitleBar.tsx:44-58` inline styles belong in CSS.
- Selection ring: scripture `:focus-visible` outline offset 8px (`canvas.css:36`) is correct for an object but draws outside the block; keep.
- Text selection color: set `::selection { background: rgba(0,162,255,0.35); }` so selection is sky, not the system blue-gray, and distinct from `.range-preview`.
- Cursor: `button { cursor: pointer }` is not native macOS behavior; native buttons use the default arrow cursor. Remove the global `cursor: pointer` and keep `pointer` only for links and text-like affordances (`.text-button`).
- Scrollbars: set `color-scheme: dark` (done) and `scrollbar-gutter: stable` on `.sidebar`; overlay scrollbars on macOS are fine by default.
- `user-select: none` on chrome (title bar, toolbar, sidebar labels) to match native, never on scripture or notes.
- Inputs: `accent-color: var(--accent)` for checkboxes in settings; Settings checkbox rows (`SettingsDialog.tsx`) should use real `Switch` styling or at least native `<label><input> …</label>` aligned with a 12px gap. Native Settings use switches; `@radix-ui/react-switch` is not installed, so a checkbox is acceptable in v1.
- Segmented controls (`.insert-translations`, `.toggle-row`): add a sliding selected-pill using `transform` (150ms `--ease-out`), the native look on macOS 26. Optional.

---

## 6. Liquid Glass integration plan

### What the package is (verified from source, not just README)

`electron-liquid-glass@1.1.1` (MIT, last published 2025-09-17, N-API prebuilds for darwin-arm64 and darwin-x64, `gypfile: false`, loaded by `node-gyp-build`). `addView(handle, { cornerRadius, tintColor, opaque })` creates one `NSGlassEffectView` (a private AppKit class, available on macOS 26+) and inserts it **behind the window's content view**. It is a whole-window backdrop, not a per-element view. On macOS < 26 it falls back to an `NSVisualEffectView` (`underWindowBackground`, behind-window blending). On non-macOS it is a no-op returning -1. The `unstable_*` methods (variant, scrim, subdued) use private APIs and the README says do not use them in production.

### Key constraint that shapes the design

Because the glass sits behind the whole web view, the web view must be transparent wherever glass should be visible. Glass can only show through regions where the renderer paints nothing (or something translucent). It cannot be placed *over* the canvas. Consequences:

- **Title bar and sidebar**: transparent/translucent CSS background. Native glass shows through. This is where glass belongs.
- **Canvas area**: must stay opaque. `.canvas-area` already has `background: var(--canvas-bg)` (#141115) and tldraw also paints `--tl-color-background` and the theme `background: '#141115'` (`MarginCanvas.tsx`). The glass is fully occluded there, so scripture and annotations never sit on translucent material.
- **Toolbar (floating over canvas)**: native glass is impossible because there is canvas behind it, not the glass view. Use CSS `backdrop-filter: blur(20px) saturate(1.4)` with `background: rgba(38,34,40,0.72)` and an inner highlight (`box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.35)`). Because the canvas is near black, the effect is subtle and tasteful; it will not look like real Liquid Glass lensing, and that is fine.
- **Popovers, command palette, dialogs**: same CSS approach (they float above opaque canvas). Use the opaque `--surface` for dialogs/inputs that hold text; a translucent+blur surface only for popovers and the palette. Keep body text on solid-enough backgrounds (alpha ≥ 0.85).

So the recommended scope is: **native glass for title bar + sidebar region, CSS glass imitation for toolbar and transient surfaces, no glass behind scripture.**

### Main-process integration (`src/main/window.ts`, see section 7)

```ts
import { BrowserWindow } from 'electron'
import os from 'node:os'

const isMac = process.platform === 'darwin'
// Darwin 25 == macOS 26. Do not use the package's execSync('sw_vers') on the main thread.
const supportsLiquidGlass = isMac && Number.parseInt(os.release(), 10) >= 25

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280, height: 840, minWidth: 760, minHeight: 520,
    show: false, title: 'Margin',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
    transparent: isMac,            // required for the glass view to show through
    backgroundColor: isMac ? '#00000000' : '#141115',
    vibrancy: false,               // README: setting vibrancy as well makes the glass blurry
    hasShadow: true,
    webPreferences: { /* unchanged: sandbox: true, contextIsolation: true, nodeIntegration: false */ },
  })
  window.once('ready-to-show', () => window.show())
  window.webContents.once('did-finish-load', () => attachGlass(window))
  return window
}
```

```ts
// src/main/glass.ts
import type { BrowserWindow } from 'electron'

export function attachGlass(window: BrowserWindow): void {
  if (process.platform !== 'darwin') return
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- native optional dependency
    const liquidGlass = require('electron-liquid-glass').default ?? require('electron-liquid-glass')
    const id = liquidGlass.addView(window.getNativeWindowHandle(), {
      cornerRadius: 0,         // window corners are drawn by the OS; do not double round
      tintColor: '#1C191D99',  // Night-violet tint at 60% so sidebar text keeps contrast
      opaque: false,
    })
    if (id < 0) throw new Error('glass unsupported')
    window.webContents.executeJavaScript(`document.documentElement.dataset.glass = 'native'`).catch(() => {})
  } catch {
    window.setVibrancy('sidebar')            // public API fallback, works on macOS < 26 too
    window.webContents.executeJavaScript(`document.documentElement.dataset.glass = 'vibrancy'`).catch(() => {})
  }
}
```

Notes:

- Pass the glass state to the renderer through a `data-glass` attribute on `<html>` (set from the main process after load) or, cleaner, expose it through a typed preload property (`margin.platform.glass: 'native' | 'vibrancy' | 'none'`) read once at startup. Avoid `executeJavaScript` in production; prefer the preload property because CSP forbids inline script and the preload bridge is already typed in `shared/ipc/contract.ts`.
- `addView` must run after `did-finish-load` (as the README does). Call it once per window. Re-call is safe: the native code removes the previous glass view first.
- After a hot reload in dev, `did-finish-load` fires again, so the replace-on-add behavior makes that safe.
- `getNativeWindowHandle()` returns a Buffer; the addon dereferences the NSView pointer inside the main thread (`RUN_ON_MAIN`), so no threading work is needed.
- Fullscreen, minimize, and appearance (light/dark) changes are handled natively. The app is dark-only; set `nativeTheme.themeSource = 'dark'` in main so the glass uses dark material regardless of the system setting.

### Renderer CSS

```css
:root[data-glass='native'] .title-bar,
:root[data-glass='native'] .sidebar { background: transparent; border-color: rgba(255,255,255,0.08); }
:root[data-glass='vibrancy'] .title-bar,
:root[data-glass='vibrancy'] .sidebar { background: rgba(28,25,29,0.55); }
:root:not([data-glass]) .title-bar,
:root:not([data-glass]) .sidebar { background: var(--chrome-bg); }   /* today's solid look */

/* Always opaque. Never reduce this alpha. */
.canvas-area { background: var(--canvas-bg); }
html, body, #root { background: transparent; }   /* only when data-glass is set, else var(--night) */
```

- Sidebar text contrast: muted text `#8C8790` was verified on Night only. Over glass, with a tint, re-check it. If it drops under 4.5:1 on a bright wallpaper, raise sidebar muted to `#A8A3AD`, or increase `tintColor` alpha. SPEC §2.1 already says text must be checked against its actual surface.
- Reduced transparency: respect `@media (prefers-reduced-transparency: reduce)` to switch to the solid `--chrome-bg`. Chromium exposes this media feature on macOS; use it as a CSS fallback, and also listen in main for `systemPreferences.getAnimationSettings()`-style changes if needed. The `:not([data-glass])` path is the same solid fallback.
- Hairlines: borders `rgba(255,255,255,0.08)` instead of `#38333A` on glass surfaces, so edges look like glass edges. Keep `--border` for opaque surfaces.
- Do not apply `backdrop-filter` to the whole sidebar when glass is native (double blur). Only for the `vibrancy`/CSS fallback if needed.
- `-webkit-app-region: drag` works on transparent areas. Verify the title bar remains draggable over the glass.

### Sandbox, contextIsolation, and packaging

- The addon is loaded in the **main process** only. The renderer stays `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; preload is unchanged. No new IPC surface other than the optional read-only glass-mode property.
- `electron-vite`: main deps are externalized by default (`externalizeDeps` is only disabled for preload in `electron.vite.config.ts`). The main bundle will `require('electron-liquid-glass')` at runtime from `node_modules`. The package declares `"type": "module"` with a CJS entry (`dist/index.cjs`), so `require` works. If the electron-vite build tries to bundle it, add `main: { build: { rollupOptions: { external: ['electron-liquid-glass'] } } }`.
- Native loading: N-API prebuilds are ABI-stable across Electron versions, so no `electron-rebuild` is needed for Electron 45. The existing `postinstall: electron-builder install-app-deps` is harmless (the package has `gypfile: false`, so nothing compiles). `better-sqlite3` is unaffected.
- electron-builder: `asarUnpack: ["**/*.node"]` is already configured, which covers `prebuilds/darwin-*/node.napi*.node`. `node-gyp-build` resolves `prebuilds/` relative to the package dir; confirm in a packaged build (`yarn dist`) that `app.asar.unpacked/node_modules/electron-liquid-glass/prebuilds/...` exists, and that `yarn dist` universal vs arm64-only matches the prebuilds shipped (both `darwin-arm64` and `darwin-x64` are included).
- Code signing and notarization: electron-builder signs unpacked `.node` files; hardened runtime is on by default. The addon calls private AppKit classes by name (`NSGlassEffectView`); notarization allows this, **Mac App Store review would not**. Margin ships as DMG/zip, so acceptable. Record this risk.
- Private API risk: `NSGlassEffectView` is private and macOS point releases may change it. Ship with the try/catch fallback above and a feature flag (`MARGIN_GLASS=0` env var, and a hidden preference). Never call `unstable_setVariant`/`setScrim`/`setSubdued` in the shipped build. The package is single-maintainer and has not been updated since September 2025; pin the exact version (the repo already pins exact versions) and add a smoke test.
- macOS < 26 and non-macOS: the package falls back to `NSVisualEffectView` on older macOS, but our code treats `supportsLiquidGlass` false as "use `window.setVibrancy('sidebar')`" so we use Electron's public API on those versions and don't depend on the addon at all. On Windows/Linux, `transparent` is false, `data-glass` is unset, and the solid chrome CSS applies.
- Transparent window caveats: `transparent: true` windows cannot be natively resized by dragging the window corner on some Electron versions with `frame: false`; with `hiddenInset` frames macOS still draws edges and resize works, but test it. Also confirm the window shadow renders (`hasShadow: true`). Window snapshot color flash on show is avoided by keeping `show: false` until `ready-to-show` (already done).

### Acceptance checklist for the glass work

1. Canvas pixel at any point reads exactly `#141115` regardless of wallpaper (screenshot sample test).
2. Sidebar and title bar show native glass on macOS 26, vibrancy on macOS 15, solid on other platforms.
3. Toggling the sidebar (`⌘\`) shows the canvas on opaque Night with no glass bleed at the seam.
4. Dragging the window by the title bar works; text fields in the title bar remain editable.
5. `yarn dist` DMG launches on a clean macOS 26 account without crashing, with `MARGIN_GLASS=0` rendering a solid fallback.
6. With "Reduce transparency" enabled in System Settings the chrome is solid.

---

## 7. Entry-point structure

### Current state

- `main.tsx` (12 lines) is fine. Add an error boundary around `<App />` and move the CSS import above the component import for deterministic order (`styles/index.css` first).
- `App.tsx` (147 lines) mixes five concerns: providers (`Tooltip.Provider`, `Toaster`), boot side effects (`initializeStudies`, `loadPreferences`, IPC subscriptions `onLibrary`/`onFlush`), global shortcuts (`keydown` for `⌘K` and `⌘\`), UI state for four dialogs plus the sidebar (`useState` x6), and layout. `editor` is held in `useState` and drilled into `Sidebar`, `Toolbar`, `CommandPalette` callbacks, and the insert dialog. Handlers for the same commands are duplicated across the toolbar, palette, and shortcuts (`addPassage`, `toggleSidebar`, `requestTagSelection`, `duplicateSelection`). `pending()` toast stubs ("X is not available yet.") are shipped to users.
- Shortcut logic is split across three places: `App.tsx` `keydown`, `canvas/tools/shortcuts.ts` + `shortcutContext.ts`, and each tooltip's hardcoded `shortcut` string (`Toolbar.tsx`, `TitleBar.tsx`, `CommandPalette.tsx`). They can drift.
- `src/main/index.ts` (62 lines) mixes window creation, security hardening (`setWindowOpenHandler`, `will-navigate`, permission handlers), single-instance logic, and IPC registration. It has no application menu, so macOS shows Electron's default menu (the "Electron" About/Services entries, no Settings…, no Undo/Redo wired to the editor). That should be a Margin menu (About Margin, Settings… ⌘,, Edit, View with Toggle Sidebar, Window).

### Target structure

```
src/renderer/src/
  main.tsx                    createRoot, ErrorBoundary, StrictMode, imports styles
  app/
    App.tsx                   <AppProviders><AppBootstrap/><AppShell/><DialogsHost/></AppProviders>
    AppProviders.tsx          Tooltip.Provider + Toaster (+ editor context)
    AppShell.tsx              layout only: TitleBar, LockNotice, Sidebar, canvas area
    DialogsHost.tsx           CommandPalette, SettingsDialog, DeleteConfirm, InsertVersesDialog
    useAppBootstrap.ts        initializeStudies, loadPreferences, IPC subscriptions, cleanup
    useGlobalShortcuts.ts     one keydown listener driven by the command registry
    commands.ts               single registry: id, title, shortcut, enabled(), run()
    uiStore.ts                zustand: sidebarOpen, commandsOpen, settingsOpen, insertQuery
    EditorContext.tsx         current tldraw Editor via context/zustand (replace prop drilling)
```

Details:

1. **`uiStore.ts` (zustand, already a dependency)**: `sidebarOpen`, `paletteOpen`, `settingsOpen`, `insertQuery: string | null`, plus actions `toggleSidebar`, `openInsert(query?)`, etc. Removes six `useState`s and every `onX` prop passed to `TitleBar`, `Toolbar`, `CommandPalette`.
2. **`commands.ts` registry**: one array of `{ id, title, shortcut?, group, enabled?, run }` consumed by `CommandPalette` (rendering and keycap), `Toolbar`/`TitleBar` tooltips (shortcut label), and `useGlobalShortcuts` (binding). Eliminates the duplicated `pending()` stubs: unimplemented commands simply aren't registered. Keep `canvas/tools/shortcuts.ts` for tldraw-scoped single-key tool shortcuts but share the same `isEditingText()` guard from `shortcutContext.ts`.
3. **`useAppBootstrap`**: `initializeStudies()`, `loadPreferences()`, `window.margin.events.onLibrary(handleLibraryEvent)`, `onFlush(flushBeforeClose)`. Add the missing `studyState.ready` gating so `AppShell` can render a quiet loading state instead of flashing the "Create a study" empty state before the library loads.
4. **`useGlobalShortcuts`**: the `keydown` effect currently depends on `editor` and re-registers on every editor change; read `editor` from the store via `getState()` inside the handler and register once. Use `event.metaKey` on macOS only (`ctrlKey` bindings are wrong for a macOS-only app and conflict with emacs-style text navigation).
5. **`AppShell`**: layout and nothing else (`<TitleBar/>`, `<Sidebar/>`, `<main>`), pulling state from stores directly. Split `EmptyState` into `NoStudyState` (currently inline in `App.tsx:94-107`) and `EmptyStudyState` (the existing component).
6. **`DialogsHost`**: mount-once host so dialogs are not siblings in `App`. Lazy-load `InsertVersesDialog` and `SettingsDialog` with `React.lazy` if bundle size matters (tldraw dominates, so low value; skip unless profiling asks).
7. **Dev tools**: move the M0/AMO/PSA toolbar buttons (`Toolbar.tsx:84-113`) into a `DevTools.tsx` rendered only under `import.meta.env.DEV` and positioned top-right, like `canvas-dev-tools` in `canvas.css:119`, so the production toolbar component carries no dev branches.
8. **Shared UI primitives** (also reduces the CSS duplication noted in section 2): `Button` (variants: default, primary, ghost, icon), `Dialog`/`Popover` wrappers that apply the shared enter/exit animation classes, `Field`/`Input`/`Select` at `--control-h-sm`. This turns `.text-button`, `.icon-button`, `.primary-button`, `.library-dialog*`, and `.dialog-panel` into one set.

Main process:

```
src/main/
  index.ts          app lifecycle only: single-instance, whenReady, activate, window-all-closed
  window.ts         createMainWindow() (flags, glass, loadURL/loadFile)
  security.ts       hardenWebContents(window): setWindowOpenHandler, will-navigate, permission handlers
  glass.ts          attachGlass(window) with fallback (section 6)
  menu.ts           buildAppMenu({ onOpenSettings, onToggleSidebar, ... })
  ipc/…             unchanged
```

`index.ts` shrinks to roughly 25 lines, and `window.ts` can be unit-tested for option values (transparent only on macOS, `vibrancy: false` when glass is on).

---

## Suggested implementation split for agents

1. **Type + copy + caps sweep** (sections 1, 3, 4): mostly mechanical; one PR. Add `blockNoun` with tests in `insertion/copy.test.ts` style (verse, range, cross-chapter range, whole chapter, multi-chapter).
2. **Density and shared primitives** (sections 2, 7.8): tokens first, then migrate components. Depends on 7 if done together.
3. **Shell extraction** (section 7): store, commands registry, shortcuts hook; no visual change. Land before 2 if possible.
4. **Motion** (section 5): after primitives exist so animations live in one place.
5. **Glass** (section 6): behind a feature flag; test on the macOS 26 dev machine; verify `yarn dist` output.

## Open questions for the product owner

1. Scripture base size: 24, 26, or 28px in SF (needs an in-app look; layout and saved studies are unaffected because anchors are word-ID-based).
2. Should the toolbar get native glass? Not possible with this package since it sits over the canvas; the CSS blur imitation is the recommendation. Say so if native-looking glass on the toolbar is a hard requirement, since it would need a different approach (a separate transparent child `BrowserWindow` or a secondary `NSGlassEffectView`, and neither is supported by this package).
3. Keep or drop the sidebar footer tagline ("A little room to study.").

## Owner decisions (2026-11-02)

- Scripture base size: **24px** (system font).
- Toolbar, popovers, palette: **solid `--surface` panels**, no CSS blur imitation. Native glass only on title bar + sidebar.
- Sidebar footer tagline "A little room to study.": **drop it**.
- **Launch straight to a blank canvas.** No "Create study" / "Your room to study" empty-library screen and no hero-style empty states. On launch, open the most recently opened study; if the library has none, silently create an "Untitled study" and open it. An empty study shows just the canvas (at most one quiet, small hint line near the toolbar — no headings, no illustration, no example card). Library folder defaults to ~/Documents/Margin without prompting.
