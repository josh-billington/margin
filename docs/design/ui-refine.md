# UI refine pass (2026-11-02)

A review of commit 33dc2f5, checked against the owner decisions in `ui-review.md`.

Screenshots are in `/tmp/margin-shots/before/` and `/tmp/margin-shots/after/`. CDP captures paint the transparent chrome over white, which makes them a worst case for chrome contrast. They do not show the real glass.

## Changes

| Before                                                                                                     | After                                                                                                                                | Why                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Native glass tint `#1c191d66`; the chrome itself was fully transparent                                     | Native tint `#14111599`, plus a CSS scrim `--glass-scrim: rgba(20,17,21,.58)` on the title bar and sidebar (glass and vibrancy)      | Light Ink text needs dark chrome even over a bright wallpaper. With white behind it, the scrim alone still gives readable contrast |
| `--text-muted` lifted only in the sidebar on glass                                                         | Also lifted in the title bar                                                                                                         | Contrast for "Saved", the icons and the headings                                                                                   |
| Active study and tag rows used `--sky-tint`                                                                | `--selected` (white at 12% alpha) with Ink text                                                                                      | Matches macOS dark sidebar selection. The pale blue wash was unreadable                                                            |
| Verse block header had two triggers (`⋯` actions menu + `···` options popover)                             | One Lucide `Ellipsis` menu. "Options…" (last item, after a separator) opens the options panel, which is anchored to the same trigger | One control. The panel opens from `onCloseAutoFocus`, so the closing menu can't steal focus back and dismiss it                    |
| Options panel autofocused its first button, showing a ring                                                 | The panel focuses itself                                                                                                             | No focus ring the user didn't ask for                                                                                              |
| Block text sat flush against the selection outline                                                         | `.passage-block` padding `12px 18px 16px`, header ellipsizes, the trigger is optically aligned (−6px)                                | The outline no longer crowds the text                                                                                              |
| Submenu triggers used a literal `›`                                                                        | Right-aligned `ChevronRight` icon                                                                                                    | Native menu anatomy                                                                                                                |
| Menu highlight was a 16% sky tint                                                                          | Solid accent with white text                                                                                                         | Native macOS menu highlight                                                                                                        |
| Tags empty copy "Give a word a color. Find a thread in the text." and a decorative tag icon in the heading | Removed. "New tag" and "Add starter tags" are rows with accent icons. "Add starter tags" only shows when there are no tags           | Quiet and functional. The icon looked like a button that did nothing                                                               |
| Dev buttons were 26px controls                                                                             | 18px, 10px text, muted, 55% opacity until hover                                                                                      | Unobtrusive. They stay top-right, clear of the tldraw license badge                                                                |
| Title-bar icons 16px / 1.75 stroke in scripture colour                                                     | 15px / 1.5 stroke in muted colour                                                                                                    | Lighter, closer to native toolbar glyphs                                                                                           |
| Note `···` text trigger                                                                                    | `Ellipsis` icon, hairline border, press scale, open state                                                                            | Consistent with the verse block                                                                                                    |
| Note width `scrollWidth + 8`                                                                               | `+ 10`; the textarea has `overflow: hidden`                                                                                          | `scrollWidth` rounds down, so the last word wrapped into a hidden second line with a scrollbar                                     |
| Translation row was cramped; "Tag selected words" / "Edit text" were inset text buttons                    | The row wraps with the accent link on the right. The final action is a full-width secondary button (`.popover-action`)               | Hierarchy and alignment                                                                                                            |
| "This passage splits or merges verses…"                                                                    | "These verses split or merge in…"                                                                                                    | Copy rule: never say "passage"                                                                                                     |

## Already sound

No changes needed here:

- Palette and Add verses have no motion when opened from the keyboard.
- Popovers scale from the Radix transform origin.
- Exits are faster than entries.
- Reduced motion strips transforms.
- Focus dimming works.
- The delete confirm dialog is clear.

## Remaining suggestions / needs the owner's eyes

1. **Real glass appearance.** Not verifiable from CDP. On macOS 26, check the title bar and sidebar over a white wallpaper and over a dark one. If the glass feels too opaque, lower `--glass-scrim` to about 0.45 and keep the native tint. electron-liquid-glass also has `unstable_setVariant(id, sidebar=16)`, which may look more native for the sidebar. It is untested, so I left it off.
2. **Traffic lights.** `trafficLightPosition {18,18}` with a 52px bar and the toggle at 78px is reasonable. Confirm against Finder/Notes in the real window.
3. **Tag popover** (toolbar "Tag selected words" after selecting words) could not be opened from a scripted selection, so it wasn't visually reviewed this pass.
4. **Default selection.** A newly inserted block stays selected, with a heavy 2px outline. Consider a lighter selection stroke for verse blocks, or deselecting after insert.
5. **Settings vs Add verses.** Settings sits centred while Add verses sits high, palette-style. That's fine, but consider making them consistent.

## Polish pass (2026-11-02)

A systematic pass over 690f8cb: tokens, interaction states, copy, long content, focus, motion, and code hygiene. Screenshots are in `/tmp/margin-shots/polish/`. The CDP caveat above still applies: the chrome looks lighter there than it really is.

### Fixed

**Bugs found while using the app**

- **The tag popover opened far from the cursor**, often off-screen. Its `position: fixed` anchor sat inside tldraw's transformed shape container, so the camera transform offset it. It now uses a Radix `virtualRef` anchor at the pointer.
- **A long study title overflowed the sidebar** and added a horizontal scrollbar, because grid items default to `min-width: auto`. The study, verse and tag lists now use `minmax(0, 1fr)`, and the sidebar is `overflow: hidden auto`. A hovered row also reserves space for its rename/delete buttons, so the title ellipsizes before them.
- **Each new block landed exactly on top of the last one.** Inserts always went to the viewport centre. Now, if that spot is taken, the block drops just below what is there and the camera pans to it (respecting reduced motion).
- **`.margin-popover button` outranked component classes.** Tag swatches rendered as rounded squares, the "Create tag" primary button lost its fill, and danger text lost its colour. The base rule is now `:where(.margin-popover button)`, which has zero specificity.
- **Menu items drew a focus ring on top of the accent highlight.** The global `[tabindex]:focus-visible` rule won over `outline: none`.
- **"Delete this verse?" was shown for Amos 1:3–5**, because the plural was stripped. It now reads "Delete these verses?" / "Delete this chapter?". The impact line uses a proper list: "1 verse block and 1 highlight".

**Selection outline (ui-refine item 4).** tldraw drew a 1.5px selection box plus a 1.5px shape indicator in its own blue (`hsl(214 84% 56%)`). Both strokes are now 1px (hinted 1.5px), via `ShapeIndicatorOverlayUtil` / `SelectionForegroundOverlayUtil.configure`, and `selectionStroke` / `selectionFill` use `--accent`. The block reads as a hairline, not a frame.

**Tag highlight popover (ui-refine item 3), reviewed via a real Highlight-mode drag**

- Before, tags were coloured text, colour was a `<select>` of lowercase names, there was a redundant "Close" button, and "Remove tag from selection" showed even with no tag applied.
- Now:
  - Each tag is a swatch + name row, with a check on the current tag. The list scrolls past 40vh.
  - A hairline separates the tags from the new-tag form, which uses the same `ColorChoices` swatches as the sidebar (extracted to `app/ColorChoices.tsx`).
  - "Remove tag" appears only when a tag is applied, in coral.
  - The dragged words stay marked while the popover is open, so it is clear what is being tagged.

**Tokens and system**

- New tokens:
  - `--on-accent`, `--text-selection`
  - `--ink-wash{,-strong,-flash}`, `--text-muted-on-glass`
  - `--shadow-{toolbar,popover,dialog}`
  - `--row-h` (28px), `--radius-xs`
  - `--duration-{fast,base,slow}`, `--toolbar-bottom`
- Every hard-coded hex/rgba, shadow, 4px radius and stray px spacing in the CSS now uses a token. The only literal colours left are the tldraw theme values in `MarginCanvas.tsx` (tldraw paints from JS) and the native window tint in main.
- Toolbar radius is concentric (`--radius-sm + --space-2`). The empty-hint offset is derived from the toolbar's size, not a magic 66px.
- Icons: one helper, `lib/icons.ts` (`iconSm` 12 / `iconMd` 14 / `iconLg` 16), all with `absoluteStrokeWidth` at 1.25px. Glyphs now render at one weight across sizes. Before there were five sizes and three stroke widths.
- Removed the unused `.primary-button`, the duplicate `.dev-tools` rule, `--ease-in-out`, and dead `getCommand` / `activeEditor` / `capitalizedNoun`.

**Interaction states**

- Added the missing hover states: danger button, text links (underline), the verse block header trigger (brightens to ink), the note trigger, the translation segmented control, "did you mean" chips, and note-option toggles.
- Selected toggles and segmented controls use `--selected`, not the pale sky wash. Hovering the current study row no longer flips it to sky blue.
- The palette highlight now matches menus: solid accent, white text and icons.
- Tag-row edit pencils show only on hover, focus or the current row, like the study row actions.
- Focus rings now cover `textarea` and sliders. Fields use an inset ring. Checkbox rings follow the checkbox's corner radius. Disabled `select`/`input` are dimmed like buttons.
- Async work shows its progress: "Saving…", "Adding…" on the insert button, and "Changing…" on the translation switch. Reference errors in Add verses are coral.

**Copy**

- "Settings…" in the palette, because it opens a dialog (it already had the ellipsis in the menu). "Library folder…" opens a chooser.
- The palette placeholder said "Search verses, studies, commands…", but studies aren't searchable. It now says "Type a reference or a command…". The typed-reference item reads "Add verses", with the reference on the right.
- "Change to JPS 1917" lost its ellipsis: it acts immediately unless a mapping needs confirmation.
- "Select some scripture words first, then choose Tag selected words." (it used to name a command that doesn't exist).
- "1 highlight uses this tag" (it said "use"). The lock notice now reads "Read-only. {host} has had this library open since …".
- Accessible names now say "Actions for Amos 1:3–5 · KJV", not "Verses actions". Colour swatches are capitalised.

**Motion**

- The save-indicator swap animated `filter: blur`. It now uses opacity plus a 2px translate.
- All entries and exits use `--ease-out` and the duration tokens. Reduced motion still strips transforms and keeps the fades.

### Needs owner eyes

1. **Traffic lights.** Checked in code only; Screen Recording permission wasn't available to capture the native window. `trafficLightPosition {18,18}` with a 16px-tall button frame centres on y=26, which is the 52px bar's centre, and the toggle starts at 78px. Compare the inset against Finder on macOS 26. If Tahoe's buttons sit 1px high, use `y: 19`.
2. **Native menu casing.** The renderer is sentence case throughout. The app menu stays in macOS Title Case ("New Study", "Add Verses…"), because Electron's role items (Hide Others, Enter Full Screen) are Title Case and can't be changed. Mixing the two in one menu looked worse. Say if you want sentence case there anyway.
3. **Icon weight.** The shared 1.25px absolute stroke is a touch heavier than the old 15px/1.5 title-bar glyphs. Lower it in `lib/icons.ts` (try 1.1) if the title bar should recede more.
4. **Palette highlight.** The palette now uses the solid accent like menus, where it used to use a sky wash. Spotlight on macOS 26 does the same, but it is a visible change.
5. **Tag pulse** animates `background` on a few words, not transform/opacity. It's cheap, but it breaks the rule. Converting it to an `::after` opacity flash is a follow-up.
6. **Note options trigger** sits outside the shape's hit area, at `right: -(control-h + 4px)`. Scripted clicks couldn't reach it, so that popover wasn't re-reviewed visually this pass. Its CSS states were updated.
7. **Delete study** removes the file but keeps a recovery copy in app data (existing behaviour). This test run left one recovery copy of a scratch "Polish test" study there.

## Fixes (2026-11-03)

Screenshots are in `/tmp/margin-shots/fixes/`. They were taken in an isolated library (`--user-data-dir` plus a seeded `libraryPath`).

1. **Highlight-mode drag preview.** Before, every word had its own tint, so a selection looked like separate chips with gaps between them. Now `highlights/bands.ts` measures the selected words and merges their rects into one band per line. Each band covers the spaces and any verse numbers between words, and it is painted under the text in `--text-selection`, like a native selection. Saved highlights stay as bold text in the tag colour, with no fill. Checked on multi-line and cross-verse ranges (`1a`, `1b`).
2. **Tag popover placement.** The popover now anchors to the bounding rect of the selected words, not the pointer. It opens below the selection, aligned to its start, and flips above when there is no room. Its collision padding covers the title bar and the floating toolbar, so it no longer hides the words or the verse number being tagged (`2a`, `2b`).
3. **Arrowheads (SPEC §2.3).** tldraw clamps its triangle head to 3× the stroke width, which is 7.5px here. `MarginArrowShapeUtil` now overrides `component` and `toSvg` to draw a filled 14px triangle head on top, with a 2.5px stroke and round joins. Its tip and 30° half-angle match tldraw's own head, so the smaller head is fully covered. Bindings, precise word anchors and the `draw` dash are unchanged. A new arrow bound to tokens 8 and 24 exactly (`3a`).
4. **Old Testament translation.** Settings now has an "Old Testament translation" select (KJV / JPS 1917), with the hint "Used when a reference does not name one." `usePrefs` is now one shared store, so a change in Settings reaches the open Add verses dialog straight away (`4`, `4b`).
5. **Pull-out connector.** The connector now starts at the measured centre of the source verse. `laidOutVerseBounds` measures it relative to the block element, so the value does not depend on the camera. When the block is not mounted it falls back to the length-based estimate. A `passageLayout` atom is bumped after each block lays out, so the connector re-measures (`5`).

## Word-bound arrow terminals (2026-11-03)

Screenshots are in `/tmp/margin-shots/arrows/` (`before-*` / `after-*`: `same-line`, `line-above`, `line-below`, `cross-block`, plus `overview`). They were taken at 100% in an isolated library, with arrows drawn by real pointer drags.

**Problem.** Word-bound terminals ended at the word's centre. The 14px head covered the word ("Gilead", "Aven", "Blessed" were unreadable), and word-bound starts pierced their source word too.

1. **Terminals sit just outside the word.** A word-bound terminal is now centred on the word's top or bottom edge, `5 × scale` page units out. The 2.5px round join adds ~1.25px, so the visible gap is ~4px at 100%. The side is chosen from the direction the arrow's body arrives from. For arcs that is the end tangent: the chord reflected across the end→middle line, using tldraw's own `middle = med − per(u)·bend`. The tip then slides along that edge towards the approach, clamped to the word's ends. Side edges are never used, because in running text they press against the neighbouring word. The head therefore lands in the line gap. The same applies to word-bound starts. The geometry lives in `bindings/terminals.ts`, which is pure and unit-tested.
2. **Still derived.** Word identity stays `{verse, token}` in binding meta. The anchor is just geometry. `reconcileWords` caches each bound word's box in passage space when the block lays out. A box is trusted only for the `props` record it was measured with, so after a reflow or resize it waits for the next measure, and culled blocks keep their last geometry. `installWordTerminals` (side effects on shape/binding changes, coalesced per microtask) re-derives anchors when either end, the bend or a bound block moves, including mid-drag before the DOM has moved. Writes go through `derived()` and stay rounded, batched and no-op-skipped, so they create no undo entries and no autosave noise.
3. **Default bend.** When an arrow is created onto a word, the bend keeps its magnitude but its sign now bulges the arc away from the block's centre, towards the nearer margin. A same-line arrow on line 1 rides in the top margin instead of dipping through line 2. Short arrows cap the bend at 15% of the chord (minimum 8), so a two-line hop no longer curls into a hook. Existing arrows and handle edits keep their bend.
4. **Head hit area and outline (closes the open item from Fixes #3).** `getGeometry` appends the 14px head as a filled `Polygon2d` after tldraw's children, so the label stays `children[1]`. `getIndicatorPath` adds the head to the path, or to `additionalPaths` and `clipPath`. The selection outline now traces the drawn head (`after-selected-head`). A point 5px off the shaft inside the head now hits the arrow.
5. **Checks.** Unit tests pass (`corpus.test.ts` fails only because it can't download the raw corpus offline). e2e `m0` passes: the binding target survives resize and relaunch. The M0 dev check now asserts that the terminal sits 3–7px outside its word. It still stops later at "passage is actually culled offscreen", which fails the same way on the unmodified build. `app.e2e` "keyboard … focus mode" is flaky on the focus-zoom restore on both builds (baseline failed 1 of 4 runs, this change 1 of 5).

### Open

- **Shafts still cross text.** Only the head and tail are kept clear. A long arc between distant lines still passes over the lines in between. Routing through line gaps would need elbow-style paths, which is not worth it yet.
- **Heads near block headers.** A word on a block's first line, approached from above, puts its head in the 12px band where the "Psalms 119:1–16 · KJV" header sits (`after-cross-block`).
- **Hover outline.** Hover shows no outline in this app's configured indicator overlay (selection does). This is unchanged and not specific to arrows.
- **Approach uses word centres.** The approach for a word↔word arrow is computed between the two word centres, not the final edge points, so it stays stable. On very short arrows the arrival can be a few degrees off the drawn tangent.

## Light mode (2026-11-03)

Margin now has a light ("paper") appearance next to the original dark one. The setting is System (default), Light or Dark. It lives in Settings > Appearance and in the View > Appearance menu. Screenshots are in `/tmp/margin-shots/light/` (`light-*` and `dark-*`, CDP/Playwright captures with `MARGIN_GLASS=0`). The dark shots match the pre-change build except for the save indicator and the arrow's hand-drawn jitter.

### How it works

- Main resolves the preference against macOS: `nativeTheme.themeSource` follows it. The resolved value goes to the renderer as a launch argument and on every `nativeTheme` `updated` event (`margin:appearance`). The renderer writes it to `<html data-appearance>`, so there is no flash and no reload. The media query is not used: Chromium did not update `prefers-color-scheme` for an unfocused window in tests.
- `tokens.css` keeps the dark values in `:root`. `:root[data-appearance='light']` overrides every themed token (canvas, chrome, surface, border, text, accent, tag colours and tints, hairlines, washes, focus dim, glass scrim, shadows). `--accent-ink` is the text colour on a solid accent fill. It replaces a hard-coded `--night`.
- tldraw: `colorScheme` follows the appearance. Both the light and dark theme colours are overridden (canvas background, selection, and the "white" slot, which Margin uses as ink for arrows and arrowheads). The focus connector, note text and highlight bands already read CSS tokens.
- Window: the opaque `backgroundColor` follows the theme. Liquid Glass is re-added with a light tint (`#f7f4f099`) or the dark tint (`#14111599`) on change, because the native view has no tint setter (`addView` replaces the previous view). The CSS scrim flips with the tokens. Vibrancy and solid fallbacks are unchanged.

### Tag palette

Names are unchanged (stored in studies). Light shades are chosen for 4.5:1 or better on the paper canvas, the chrome and the surface:

| Tag    | Dark      | Light     | On canvas `#f7f4f0` | On chrome `#f0ece7` |
| ------ | --------- | --------- | ------------------- | ------------------- |
| sky    | `#00a2ff` | `#0865b8` | 5.5                 | 5.1                 |
| violet | `#a78bff` | `#6c4fd6` | 5.1                 | 4.7                 |
| rose   | `#ff5fb0` | `#c2185f` | 5.3                 | 4.9                 |
| coral  | `#ff6b5b` | `#c73320` | 5.0                 | 4.6                 |
| amber  | `#f2a23a` | `#8e5a00` | 5.3                 | 4.9                 |
| green  | `#30b377` | `#167347` | 5.5                 | 5.0                 |

Light tints are the same colours at 16%. `tokens.test.ts` parses `tokens.css` and checks these (WCAG contrast) in both themes, along with ink, scripture, muted and accent text.

### Questions for the owner

1. **Amber reads brown.** Amber at 4.5:1 on paper has to be dark. If the scripture should stay brighter, the bold weight could be relaxed to the large-text threshold (3:1), which needs a decision.
2. **Dark muted on `--surface`** is 4.46:1, just under 4.5. It predates this change and is left alone so dark stays identical.
3. **White on the dark sky accent** (menu highlight) is 2.7:1, also unchanged.
4. **Real glass in light** is not verifiable from CDP. Check the title bar and sidebar over dark and light wallpapers. The light scrim is 0.62; lower it if the glass looks too milky.
5. **Handwritten notes** stay Gochi Hand. The ink is dark in light mode, with no other change.

### Refinement pass (2026-11-03)

Screenshots: `/tmp/margin-shots/light-refined/` (`light-*` and `dark-*`: 1 empty, 2 study, 3 palette, 4 settings, 5 tag popover, 6 focus, 7 highlight-drag band, 8 passage menu, 9 delete dialog, 10 edit tag; `switch-to-*` are frames taken right after a live appearance switch). All are CDP captures with `MARGIN_GLASS=0`.

| Before                                                                                | After                                                                                                      | Why                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Light `--accent` / `--sky` `#0865b8`                                                  | `#0067c8`                                                                                                  | The old blue read navy next to the warm paper. The new one is closer to the macOS system blue and still 4.7:1 on chrome and 5.6:1 under white.                                                                                                                                                 |
| Light `--amber` `#8e5a00`                                                             | `#a05600`                                                                                                  | At 4.5:1 on paper an amber is always dark, and a yellow hue that dark turns olive-brown. Turning the hue toward orange (about 33°) at full saturation keeps it reading as warm ochre ink rather than mud. It is 4.67:1 on chrome and still clearly different from coral (`#c73320`, about 7°). |
| Light `--surface` `#fcfbf9`                                                           | `#fffdfa`                                                                                                  | Popovers, the palette and dialogs barely separated from the `#f7f4f0` canvas. A slightly whiter sheet lifts them the way native light popovers do.                                                                                                                                             |
| Light shadows: one blurred layer each                                                 | Three layers: contact (1–3px), mid (4–20px) and a faint ambient (14–48px), warm-neutral `rgba(40,30,20,…)` | On paper a single wide shadow looks like a smudge (the delete dialog showed a muddy halo). Layering gives a crisp edge plus soft depth at lower total opacity. Dark is unchanged.                                                                                                              |
| Light `--border` `#d9d3cb`                                                            | `#dcd6ce`                                                                                                  | One step softer now that the shadows carry the edge.                                                                                                                                                                                                                                           |
| Arrows, the default note ink and the focus connector use `--ink` (`#1c191d` in light) | New `--pen` token: `#3a3540` warm graphite in light, `#edf1e4` in dark (same as before)                    | Near-black 2.5px arrows sat on top of the scripture (`#2b272e`). Graphite makes pen marks read as annotation beneath the text, and it is still 10:1. tldraw's "white" slot (the arrow ink) mirrors it. Stored notes keep `color: 'ink'`; it now maps to `--pen`.                               |
| Light `--text-selection` 25%                                                          | 20% (new blue)                                                                                             | The drag band was greyish and heavy. 20% is closer to the native light-mode selection.                                                                                                                                                                                                         |
| Dark `--text-muted` `#8c8790` (4.46:1 on `--surface`)                                 | `#8e8992` (4.58:1)                                                                                         | Fixes the old dark-mode miss. The difference is a 2/255 lift, which you can't see.                                                                                                                                                                                                             |
| Menu and palette highlight: `--on-accent` (#fff) on `--accent` (dark 2.7:1)           | New `--accent-fill`: dark `#0b6bd6` (5.1:1), light = `--accent`                                            | **Visible dark change:** the dark menu and ⌘K highlight is now a deeper blue, as native dark menus are, instead of the bright sky. Sky stays the accent for text, focus rings, selection and the primary button (which uses dark `--accent-ink` text on sky).                                  |

Unchanged after review: the paper canvas `#f7f4f0` and chrome `#f0ece7` (a calm hierarchy with the sidebar slightly darker, like macOS), scripture `#2b272e`, muted `#6a656f` for verse numbers and headers (5.2:1, quiet enough), the focus dim (0.28 on paper reads like tracing paper), and the selection outline.

Light tag shades (WCAG, on canvas / chrome / surface): sky `#0067c8` 5.1 / 4.7 / 5.5; violet `#6c4fd6` 5.1 / 4.8 / 5.6; rose `#c2185f` 5.3 / 5.0 / 5.8; coral `#c73320` 4.9 / 4.6 / 5.3; amber `#a05600` 5.0 / 4.7 / 5.4; green `#167347` 5.4 / 5.0 / 5.8. `tokens.test.ts` now checks every text token (`--pen` included) on all three backgrounds in both themes, and checks `--on-accent` on `--accent-fill`. The old dark exceptions are gone.

Live switching: the first frame after a switch is already entirely the new theme in both directions: canvas, chrome, and the arrow ink repainted by tldraw. There is no flash and no stale tldraw colour.

Open for the owner: (1) Amber is now ochre-orange rather than brown. If it should read as a true yellow-amber, the only route is a lower bar for bold scripture tags (3:1, large-text). (2) The deeper dark menu highlight, noted above. (3) Real Liquid Glass in light still needs a look over real wallpapers.

## Owner tweaks (2026-11-03)

- Dark text is neutral, near-pure white: `--ink`/`--pen` `#fafafa`, `--text-scripture` `#f0f0f0` (was the greenish `#edf1e4`/`#dce0d4`). The site's dark tokens match; the logo keeps brand Ink.
- Panning: a Hand tool in the toolbar; Space-drag works even when focus is on `<body>` after a dialog closes (`canvas/tools/spacePan.ts`); toolbar buttons no longer take focus from the canvas on click.
- Dialogs and toasts share `--dialog-bg` (dark `#1f1b20`, between chrome and surface; light `--surface`). Sonner follows the app appearance and its toasts/buttons use app tokens (accent primary, hover-fill secondary) instead of sonner's black/white.
- Sidebar breathes more: 24px between sections, 12px top padding, 4px under headings, 4px between rows.
- Palette and dialogs take the chrome's glass vocabulary (still solid, no CSS blur): hairline border, faint top-edge highlight (`--edge-highlight`), 18px radius on the palette, and a neutral `--selected` wash for the active row instead of the blue menu fill. The "Amos 1:3–5" example hint on "Add verses…" is gone.
- Dev fixture buttons removed from the UI; in `yarn dev` use `marginCanvasDev.insertFixture('amos' | 'psalm')` / `marginCanvasDev.runM0Checks()` in the console.
- Note on selected words: with scripture words selected, T or the toolbar Note button creates a note to the right of the passage (stacked below any note already there) with an arrow bound to the selected word, or the middle word of a phrase, and starts editing. Shares `canvas/bindings/noteToWord.ts` with lookup's Add as note. Note text is now written as it is typed; a new note's first text belongs to its creation undo step.
