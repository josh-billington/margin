# Margin: Bible study canvas

Product and design specification · v0.3 · 2026-11-02 · working title

Margin is a desktop app for slow, visual Bible study. You place scripture on a dark, infinite canvas, focus on a passage or verse, and write notes around it. Arrows attach to specific words. Highlights identify phrases with tags.

The central promise is that an annotation stays attached to the same word through text reflow, undo, save, app restart, and app updates.

## 1. Goals and scope

### 1.1 v1 goals

- Add a verse, a verse range, a whole chapter, or a range across chapters within one book.
- Read scripture comfortably and focus on one passage or verse.
- Write handwritten-style notes anywhere on the canvas, with a plain-font option for readability.
- Draw hand-drawn arrows between notes, scripture words, and free canvas points.
- Apply user-defined tags to words and phrases.
- Bundle KJV for the whole Bible and JPS 1917 for the Tanakh.
- Work fully offline after installation. Save studies as plain local JSON files.
- Preserve studies when saving fails or another program changes a file.

### 1.2 Non-goals for v1

- Cross-reference linking, hover previews, and automatic verse insertion from notes.
- Freehand ink.
- Sync services, including S3.
- Licensed or API-based translations, including ESV, RSV, and NJPS 1985.
- Collaboration, mobile, and web versions.
- Global tags and tag search across studies.
- Focus on several passages at once.
- Parallel translation columns inside one passage block.
- Ranges that cross book boundaries.

The bundled providers share an interface. Licensed-provider storage policy remains deferred until a specific provider is implemented.

### 1.3 Adopted defaults

- Keep **Margin** as the working name. Naming does not block the prototype.
- Tags belong to one study. New studies start without tags.
- An optional starter set creates ordinary, editable study tags.
- Focus includes one passage at a time.
- Each passage block displays one translation. Comparisons use separate blocks.
- Future global tag templates copy tags into studies. They do not create shared mutable dependencies.

## 2. Visual language

The canvas is almost black, scripture uses calm sans-serif type, and notes use white marker-style handwriting. Sky is the interface accent and the default tag color. Other tag colors appear when the reader assigns them.

Scripture remains the main reading surface. Notes are brighter, but the difference is restrained. Chrome, popovers, and selection controls do not compete with the text.

### 2.1 Color tokens

The brand colors are Ink `#EDF1E4`, Sky `#00A2FF`, and Night `#141115`. Other neutrals retain Night's slight violet tint.

| Token | Value | Use |
| --- | --- | --- |
| `--night`, `--canvas-bg` | `#141115` | Infinite canvas |
| `--canvas-dot` | `#1D1A1F` | Optional dot grid |
| `--chrome-bg` | `#1C191D` | Title bar and sidebar |
| `--surface` | `#262228` | Toolbar and popovers |
| `--border` | `#38333A` | Decorative hairlines and popover borders |
| `--text-muted` | `#8C8790` | References, verse numbers, and secondary text |
| `--text-scripture` | `#DCE0D4` | Scripture text |
| `--ink` | `#EDF1E4` | Notes, arrows, and primary interface text |
| `--accent` | `#00A2FF` | Selection, focus rings, and default tags |
| `--focus-dim` | `rgba(20,17,21,0.78)` | Unfocused content |

The contrast ratios below use solid colors against Night at full opacity. Muted text is approximately 5.3:1, scripture is 14.0:1, and Ink is 16.3:1. Controls and text must also be checked against their actual surface backgrounds. The border token alone does not identify an interactive control.

| Palette name | Hex | Contrast on Night | Optional starter tag |
| --- | --- | --- | --- |
| Sky | `#00A2FF` | 6.8:1 | Place |
| Violet | `#A78BFF` | 6.9:1 | Person |
| Rose | `#FF5FB0` | 6.7:1 | Repeated word |
| Coral | `#FF6B5B` | 6.7:1 | Judgement |
| Amber | `#F2A23A` | 8.9:1 | Promise |
| Green | `#30B377` | 7.0:1 | Command |

Each palette color has a 16% alpha tint for interface hover and selection backgrounds. Scripture highlights have no background fill.

Color identifies a tag visually. Hover, keyboard focus, and accessible descriptions expose its name. Two tags can share a color. Hue alone does not communicate the tag's meaning.

The app is dark-only in v1. A future paper theme uses the same token system.

### 2.2 Typography

| Role | Font | Size at 100% canvas zoom | Notes |
| --- | --- | --- | --- |
| Scripture | Nunito Sans | 28px, line-height 1.55 | Weight 400 |
| Highlighted words | Nunito Sans | Same as scripture | Weight 700 and tag color |
| Verse numbers | Nunito Sans | 0.55em, superscript | Muted |
| Passage reference | Cal Sans | 18px | Letter-spacing 0.01em, Ink when focused |
| Study title | Cal Sans | 24px | Title bar and empty state |
| Notes | Gochi Hand | 22px base | Default handwritten style |
| Plain-font notes | Nunito Sans | 22px base | Readability option |
| Interface chrome | Nunito Sans | 13px base | Independent of canvas zoom |

Fonts and their license files ship with the app. No font loads from the network. Cal Sans is reserved for headings.

Note sizes are S 18px, M 22px, L 28px, and XL 36px. Scripture size scales per block. New passages use a width of 720 canvas units, with horizontal resizing down to 240 units. Focus respects the minimum reading scale in section 5.

### 2.3 Arrows

- Use tldraw's hand-drawn arrow style if the prototype meets the visual requirements.
- Keep stroke variation deterministic for each shape.
- Target a 2.5px stroke in Ink at 100% zoom, with round caps.
- Use a filled triangular head approximately 14px long at 100% zoom.
- Start with a gentle arc. A midpoint handle changes the bend.
- Exact stroke dimensions depend on the pinned SDK's supported styling. Any custom drawing needed to meet them is resolved in M0.

### 2.4 Highlights

A highlight is either plain (it carries its own palette color) or tagged (it uses a tag's color), over a contiguous range of whole words in one passage block. Highlighted words use weight 700 and the highlight's color (the tag color, or the plain color). They have no permanent background fill or underline.

Hover or keyboard focus shows the tag name, or "Highlight" for a plain highlight. An accessible description exposes the same information. Temporary text selection and word-anchor previews remain visually distinct from saved highlights.

## 3. App structure and first use

- The title bar shows the study title, command palette, settings, and save state.
- The left sidebar contains studies and the current study's tags. `⌘\` toggles it.
- The canvas fills the remaining window.
- A bottom-center toolbar contains Select, Note, Arrow, Highlight, Add passage, and zoom controls.
- `⌘K` opens the command palette for passage insertion, study navigation, and commands.
- Contextual popovers expose properties. There is no permanent inspector.

The first launch creates or opens a library. The default location is `~/Documents/Margin/`, and the reader can choose another folder. Installation and first use require no network connection.

An empty library offers **Create study**. An empty study offers **Add passage**, a reference example such as `Amos 1:3-5`, and a short hint for creating a note. Optional starter tags are available from the tag list and never appear automatically.

Save state is visible as **Saved**, **Saving**, **Unsaved changes**, or **Save failed**. A save error offers Retry and Save a copy. The current document stays in memory.

## 4. Core objects and editing

### 4.1 Passage block

A passage block displays one translation and owns its text snapshot and highlights.

- Add it through Add passage or the command palette.
- The parser accepts common book abbreviations and references such as `Amos 1:3`, `Amos 1:3-5`, `Amos 1`, and `Romans 8:28-9:5`.
- The insertion preview shows the resolved reference, translation, and numbering system before confirmation.
- The block displays a reference header and scripture. Flowing text is the default. One verse per line is optional.
- Drag the header to move the block. Drag either horizontal edge to change its width. Height follows text layout.
- The popover offers translation, layout, verse numbers, KJV supplied-word italics, and scripture size.
- Verse boundaries remain available to keyboard navigation when verse numbers are hidden.

Adding highlights or word-bound arrows locks the block's translation and passage range. Removing those annotations unlocks these settings. Moving, resizing, changing layout, and toggling italics remain available.

Changing an unannotated block's translation preserves the passage's content through the versification map. If the mapping is incomplete or ambiguous, the app presents the resolved options before changing the block. It never silently substitutes different verses.

If JPS is the default and the reader enters a New Testament passage, the insertion preview offers KJV with a notice. The reader confirms the actual translation before insertion.

### 4.2 Note

`T` or a double-click on empty canvas creates a note. A click starts a note that grows with its text. A drag sets a wrapping width.

Notes support plain text and `*emphasis*`. Bible references remain ordinary text in v1. They gain link styling when cross-reference interaction exists.

Options include size, Ink or a palette color, handwritten or plain font, and rotation from -6 to +6 degrees. New notes are unrotated. Rotation is a choice, not a random effect.

A note can have an explicit **Keep with passage** association, optionally narrowed to a verse. This association affects focus visibility. It does not make the note move with the passage.

### 4.3 Arrow

Select Arrow or press `A`, then drag from source to target. Each terminal attaches to a note, a scripture word, or a free canvas point.

- A word under the pointer receives a temporary underline before attachment.
- A word attachment targets that word's bounds, not the outer boundary of its passage.
- Moving a note or reflowing scripture updates the arrow's geometry.
- The midpoint handle changes its bend. `X` reverses the bend when an arrow is selected and no text editor is active.
- Arrow terminals remain attached when the target is offscreen and later returns.

Word identity is persistent. The normalized coordinates used to render an attachment are derived geometry, as specified in section 9.

### 4.4 Highlight

In Highlight mode, drag across scripture words. The range snaps to whole words and can span verses within that block. The highlight applies immediately as a plain highlight in the current highlight color (amber by default, remembered in preferences), with no popover and no tag required. A click on a single word highlights that word. Choosing a color in the highlight popover also makes it the current color.

Tags are optional. The keyboard alternative enters text selection inside a passage, extends the range with standard selection keys, and invokes **Tag selection** (`⇧⌘H`), which opens the tag popover to choose or create a tag. `⌥` plus a text drag is an optional shortcut. The toolbar and keyboard command provide the same function without the modifier.

Highlights do not overlap. A new assignment replaces tags only inside the selected range. The app preserves any unselected prefix or suffix of an existing highlight. Adjacent ranges merge into one highlight when they have the same tag, or the same color and no tag. The entire edit is one undo transaction.

For example, if words 1 through 8 use Place and words 3 through 5 receive Person, the result is Place on 1 through 2, Person on 3 through 5, and Place on 6 through 8.

An unmodified click on a highlight opens a small popover if the pointer did not drag: color swatches to recolor it (clicking one turns a tagged highlight back into a plain one), **Remove highlight**, and a secondary **Add to tag** list of existing tags (with a collapsed **New tag** form). Dragging across highlighted text in Highlight mode replaces the highlight under the drag. Keyboard focus exposes open-popover (`Enter`) and remove (`Delete`) actions.

### 4.5 Tag

A tag has an ID, name, and palette color. Tags belong to one study. Plain highlights do not need a tag; sidebar counts, tag navigation, and tag deletion ignore them. Creating a tag from a highlight popover and applying it form one undo transaction.

The sidebar shows the number of highlight ranges for each tag. Renaming or recoloring a tag updates all of its highlights in that study.

Selecting a tag briefly emphasizes matching highlights and shows a match count with previous and next navigation. Reduced-motion mode uses a static emphasis. Tag matching does not depend on distinguishing hues.

Deleting a tag with highlights offers either reassignment or removal of those highlights. The chosen action is undoable as one transaction.

### 4.6 Duplication, deletion, and pull-out behavior

- Duplicating a passage copies its text snapshot, options, and highlights. It assigns new shape and highlight IDs and reuses the study's tag IDs.
- Duplicating a passage alone does not copy incident arrows or associated notes.
- Duplicating a selection remaps bindings when both endpoints are copied. If a copied arrow's target is outside the copied selection, that terminal becomes a free point at its current position.
- Copying between studies imports referenced tags. An existing tag is reused only when its name and color match. ID collisions never replace destination tags.
- Deleting a passage removes its highlights and incident arrows. A confirmation lists the affected annotation counts. Bulk deletion uses one confirmation.
- Deleting a note removes its incident arrows. Deleting a passage clears associations on surviving notes without deleting those notes.
- Each deletion or duplication is one undo transaction, including tag imports and binding changes.
- Pulling out a verse creates a new block from the existing text snapshot at 1.4 times the source block's font scale. It copies highlights intersecting that verse, with fresh IDs. Notes and arrows stay with the original.
- A pulled-out block records its source passage and verse. A faint connector is derived from that relationship. Deleting either block removes the connector without deleting the other block.
- Pulled-out highlights are independent copies. Later tag assignments in either block do not propagate to the other.

## 5. Focus mode

Focus is temporary reading state. It is not saved in passage props and does not enter document undo history.

| Action | Result |
| --- | --- |
| Select a passage and press `F`, or double-click its header | Focus that passage |
| In passage focus, click a verse number or use the verse action | Focus that verse |
| In passage or verse focus, use `↑` or `↓` when no text editor is active | Step through verses in the block |
| Press `⇧F` with an active verse | Pull out that verse and focus the new block |
| Press `Esc` | Dismiss an open popover or text interaction first, then step from verse to passage to canvas |

### 5.1 Camera behavior

- Passage focus fits the block with a margin when the resulting scripture remains readable.
- Focus never automatically reduces effective scripture size below 22 screen pixels. If the passage is too tall to fit at that size, the camera centers the active verse or the beginning of the passage.
- Verse focus centers the verse and fits it subject to the same reading limit and the canvas zoom limits.
- The reader can pan and zoom while focused. Focus does not lock the camera.
- Connected notes do not enlarge the automatic camera bounds.
- Entering passage focus saves the canvas camera. Entering verse focus saves the passage camera. Esc restores the camera saved for the previous level.
- Selecting another passage through an explicit focus action replaces the focused passage while preserving the original canvas return position.
- Camera moves use a 280ms ease-out. The OS reduced-motion setting replaces animation with an immediate move. New input interrupts a camera move.

### 5.2 Which annotations stay bright

In passage focus, that passage stays bright. Notes connected directly to its words by arrows, and notes explicitly associated with it, stay bright. Their direct connecting arrows stay bright.

In verse focus, the active verse stays bright. Other scripture in the block fades to approximately 25% opacity. Notes connected directly to that verse, notes associated with that verse, and notes associated with the whole passage stay bright.

Brightness does not propagate through additional arrows to other passages or notes. Arrows that do not connect directly to the focused content dim. Unrelated content dims with `--focus-dim`.

Proximity alone does not associate a note with scripture. There is no 400-unit distance rule. Runtime rendering applies dimming without modifying saved shape opacity or highlight colors.

## 6. Canvas interaction and accessibility

### 6.1 Pointer and keyboard contract

| Input | Action |
| --- | --- |
| Two-finger trackpad scroll, Space + drag, or middle-drag | Pan |
| Pinch or `⌘` + scroll | Zoom from 10% to 400%, centered on the pointer |
| `⌘0`, `⌘1`, `⌘2` | Fit everything, 100%, fit selection |
| `V`, `T`, `A`, `H` | Select, Note, Arrow, Highlight |
| `⌘K` | Command palette |
| `⌘\` | Toggle sidebar |
| `F`, `⇧F`, `Esc` | Focus, pull out verse, step back |
| `⌘Z`, `⇧⌘Z` | Undo and redo |
| `⌘D` | Duplicate selection |
| Delete | Delete selection |
| Drag on empty canvas in Select mode | Box select |
| Drag a passage header | Move passage |
| Drag scripture text in Select mode | Select text |
| Drag scripture text in Highlight mode | Select a range to tag |
| Double-click scripture text | Select a word |
| Double-click a passage header | Focus passage |
| Double-click empty canvas | Create note |

Pointer capture preserves a text drag across lines and beyond the passage edge. Overlays and selection handles must not obscure word hit-testing.

Text fields, active note editors, text selection, IME composition, and popovers take priority over canvas shortcuts. In those contexts, arrow keys, single-letter keys, and Delete retain their text or control behavior. `Esc` ends the innermost active interaction before changing reading focus.

### 6.2 Text, copying, and keyboard access

- Scripture remains selectable as real text.
- Copy from a passage produces the selected words followed by the relevant reference and translation name.
- Copying a canvas shape selection is distinct from copying selected scripture text.
- The keyboard can navigate passages and verses, enter text selection, tag a selection, inspect highlights, and open object actions.
- Header actions include Focus passage, Focus verse, and Pull out verse. Verse actions remain available when verse numbers are hidden.
- Tool buttons have accessible names, visible focus rings, and shortcut hints.
- Accessible passage content follows scripture order rather than spatial canvas order. The sidebar supplies a navigable passage list for keyboard and screen-reader access.
- Settings include a plain-font default for new notes and an option to display existing handwritten notes in the plain font without changing saved note preferences.

### 6.3 Undo history

Undo and redo cover document changes, including tags, highlights, bindings, and object edits. Reading focus, camera movement, temporary text selection, and popover state do not create document undo steps.

Each study retains its latest 1,000 committed document transactions during the app session, including across study switches. History is not persisted across app restarts. Loading an externally changed document resets that study's history after preserving any local conflict copy.

Text editing uses normal editor undo while a note is active. Committed note edits enter document history as grouped editing transactions. Derived arrow-layout updates never create extra undo steps.

## 7. Bible text, references, and stable word identity

### 7.1 Bundled sources

| Translation | v1 plan |
| --- | --- |
| KJV | Bundle a pinned public-domain edition with supplied-word italics preserved. Evaluate eBible.org USFM or scrollmapper data, then record the selected source explicitly. |
| JPS 1917 | Bundle the exact JPS 1917 edition from a pinned Sefaria export or another verified source. Use that edition's actual verse numbering. |

The importer records translation ID, exact edition name, upstream URL, upstream revision or retrieval date, source checksum, rights and attribution metadata, corpus revision, and tokenizer version.

Build inputs are pinned and retained. Updating upstream text is an explicit import operation. A normal build never silently fetches a different edition or a provider's default English text.

The app bundles the resulting text and token data in SQLite. A fresh installation works with the network disconnected. Text size is measured from the selected sources rather than assumed to fit a 5 MB target.

KJV is the default translation. Settings can choose a separate Old Testament default. JPS is available only for its supported books.

The source's exact rights metadata and notices ship with the app. Public-domain status of an edition does not replace source and transcription provenance checks.

### 7.2 Reference interpretation

- Use USFM book IDs internally, such as `AMO`, and translate aliases at the parser boundary.
- Interpret an unqualified reference in the selected translation's numbering system.
- Allow an explicit translation qualifier, such as `KJV Joel 2:28`, in the insertion command.
- Show the resolved translation and reference before insertion. An unresolved or ambiguous reference produces a correction prompt, never a guess.
- Store full references for both ends of a range. A reference includes book, chapter, and verse, with its numbering system supplied by the text edition.
- The chapter shorthand expands using the selected edition's actual chapter boundaries.
- A passage can contain an ordered list of resolved ranges when mapping an equivalent passage produces several ranges.

The app bundles a versioned mapping between the selected KJV and JPS editions. The map supports one-to-many and many-to-one relationships, chapter-boundary changes, and source-specific treatment of psalm superscriptions. It records unmapped content explicitly.

For example, JPS Malachi 3:19 can display `KJV 4:1` as a muted equivalent. A formatted identifier such as `AMO.1.3` is not a universal reference without the edition's numbering system.

The importer verifies the mapping against the exact bundled editions. Tests include the Malachi and Joel chapter boundaries, psalm superscriptions, and ranges across chapters. Superscriptions are not assumed to be numbered identically in every source.

### 7.3 Provider interface

The v1 provider contract covers bundled text retrieval. The following types describe the domain, not a second persistence format.

```typescript
type TranslationId = 'kjv' | 'jps1917'
type BookId = string // Validated USFM book ID from the bundled book catalog.

interface VerseRef {
	book: BookId
	chapter: number
	verse: number
}

interface PassageRange {
	start: VerseRef
	end: VerseRef // Inclusive. Both ends belong to the same book.
}

interface TextEdition {
	translationId: TranslationId
	editionName: string
	versificationId: string
	corpusRevision: string
	tokenizerVersion: string
}

interface BibleProvider {
	edition: TextEdition
	name: string
	books: readonly BookId[]
	getPassage(ranges: readonly PassageRange[]): Promise<PassageText>
}

interface PassageText {
	edition: TextEdition
	ranges: PassageRange[]
	verses: Verse[] // In canonical order for this edition.
}

interface Verse {
	ref: VerseRef
	paragraphBreakBefore: boolean
	tokens: Token[]
}

interface Token {
	i: number // Zero-based within this verse and tokenizer version.
	leading: string // Opening punctuation.
	runs: { text: string; italic: boolean }[]
	trailing: string // Closing punctuation.
	spaceAfter: string
}
```

Import normalization preserves opening and closing punctuation, whitespace, and partial-word italics. A token is a word. Apostrophes inside words and hyphenated compounds remain inside one token in tokenizer v1. The tokenizer has fixtures for quotation marks, contractions, compounds, verse boundaries, and supplied words.

Import handling for numbered superscriptions follows the selected source and mapping table. Source headings that are not scripture remain separate metadata and never masquerade as words in an ordinary verse.

Future licensed providers extend this contract with explicit attribution, persistence, export, cache expiry, and storage policies. A verse-count-only `canStore` flag is not the policy model.

### 7.4 Immutable text snapshots and anchors

Every passage stores an immutable `PassageText` snapshot in its shape props. The snapshot contains the exact tokens used when the block was created, plus its corpus and tokenizer versions. Only bundled public-domain text is persisted in v1.

An arrow or highlight identifies a full verse reference and token index inside that snapshot. It never uses pixels as word identity. Character positions inside a token may describe typography, but do not identify annotation targets.

An app update does not replace existing passage snapshots. New passages use the current bundled corpus. A future explicit text-update action must migrate annotations and report unresolved targets before replacing a snapshot.

On load, validation checks every anchor and highlight range against its owning snapshot. Invalid annotation records remain available in recovery data. The app reports the affected annotations rather than attaching them to nearby words.

## 8. Document model and local storage

### 8.1 One authoritative canvas document

The tldraw document is the authoritative representation of passages, notes, arrows, bindings, and tags. There are no parallel top-level arrays containing another copy of those objects.

A study has one tldraw page. That page's app-owned metadata contains the tag catalog. Tag edits therefore participate in the same document history as highlight edits. App validation and migrations cover this metadata.

Passage shapes own their highlights and text snapshots. Note shapes own note options and explicit passage associations. Arrow shapes and bindings own arrow state and word targets. A study envelope contains identity, title, timestamps, revision, and the tldraw document snapshot.

The schemas below describe the saved envelope and app-owned props. Shape position and rotation use native tldraw fields rather than duplicate values inside props.

```typescript
type ULID = string
type PaletteColor = 'sky' | 'violet' | 'rose' | 'coral' | 'amber' | 'green'

interface StudyFile {
	format: 'margin-study'
	schemaVersion: 1
	id: ULID
	title: string
	createdAt: string
	updatedAt: string
	revision: number
	document: TldrawDocumentSnapshot
}

interface MarginPageMetadata {
	schemaVersion: 1
	tags: Tag[]
}

interface Tag {
	id: ULID
	name: string
	color: PaletteColor
}

interface PassageProps {
	width: number
	text: PassageText
	layout: 'flow' | 'verse-per-line'
	showVerseNumbers: boolean
	showSuppliedWordItalics: boolean
	fontScale: number
	highlights: Highlight[]
	pulledFrom?: { passageId: string; verse: VerseRef }
}

interface NoteProps {
	width?: number
	text: string
	size: 'S' | 'M' | 'L' | 'XL'
	color: 'ink' | PaletteColor
	font: 'handwritten' | 'plain'
	association?: { passageId: string; verse?: VerseRef }
}

interface WordTarget {
	verse: VerseRef
	token: number
}

interface WordBindingMetadata {
	schemaVersion: 1
	target: WordTarget
}

interface Highlight {
	id: ULID
	// Exactly one of tagId or color is present.
	tagId?: ULID
	color?: PaletteColor // Plain highlight: sky, violet, rose, coral, amber, or green.
	start: WordTarget
	end: WordTarget // Inclusive, ordered within the owning text snapshot.
}
```

`TldrawDocumentSnapshot` denotes the document snapshot type from the pinned SDK. It is not a hand-maintained copy of the SDK schema.

Study, tag, and highlight IDs are ULIDs. Native tldraw shapes and bindings use SDK record IDs. References between shapes use those record IDs.

The app owns envelope and metadata migrations. tldraw migrations cover SDK records and custom shape props. Loading a newer unsupported schema leaves the file untouched and reports the required app version.

### 8.2 Files and local session state

The reader chooses the library folder. Its default structure is:

```
~/Documents/Margin/
  library.json
  studies/
    <study-id>.study.json
```

`library.json` is a rebuildable index of study IDs, titles, and timestamps. Study files are authoritative. A missing or stale index is reconstructed from validated study files. Tags live inside their studies.

On macOS, app-private data lives under `~/Library/Application Support/Margin/`. It includes per-study camera state, recovery versions, and app preferences. Provider caches use the app's cache directory, outside the library folder. The app does not assume that a hidden folder is excluded from Dropbox or another sync tool.

Save the tldraw document snapshot in the study file. Store the camera and other intentionally restored session fields separately. Selection and reading focus reset on open. Panning never changes a study's document timestamp or revision.

### 8.3 Autosave and recovery

- Debounce document saves for 500ms, with a maximum wait of 2 seconds during continuous editing.
- Serialize writes for each study. A stale queued snapshot never overwrites a newer saved revision.
- Write a temporary file in the destination directory, flush it, and atomically rename it over the target.
- Retain the previous on-disk version before replacement. Keep the latest 20 recovery versions per study in app-private storage.
- Advance the revision and `updatedAt` only when a document change saves successfully.
- Flush pending saves before study switch and normal app close. A save failure leaves the study open or offers an explicit save-copy or discard choice.
- After a crash, restore the latest valid file and offer newer recovery data when available. The save indicator never claims unsaved edits reached disk.
- Only one Margin process writes a library at a time. Another process opens it read-only or asks the reader to switch to the existing instance.

### 8.4 External changes and conflicts

The app watches the library and recognizes its own writes using the saved revision and content hash. It validates complete replacement files before applying them.

| Situation | Behavior |
| --- | --- |
| External change to a clean study | Reload the valid document, preserve local camera where possible, reset history, and show a notice |
| External change while local edits are dirty | Save local edits as a new study with a new ID and a conflict-copy title. Preserve the external original and show both in the study list |
| Invalid or unsupported external file | Keep the current document in memory. Show the error and offer recovery or Save a copy |
| External deletion of an open study | Keep it in memory and offer Save a copy or close. Do not silently recreate the deleted file |
| Save detects a different on-disk revision or hash | Handle it as a conflict before replacement |

A filesystem watcher is not a transaction mechanism. Margin retains previous disk versions and local conflict copies so observed conflicts do not discard either version. It does not promise automatic merging with arbitrary external writers.

Object IDs, timestamps, and one file per study support future sync work, but do not define a safe sync algorithm. S3 sync requires its own revision, deletion, and conflict design. Last-writer-wins by timestamp is not the default.

## 9. Technical architecture

| Layer | Choice |
| --- | --- |
| Shell | Electron with electron-vite, macOS first |
| UI | React 19 and TypeScript |
| Canvas | tldraw, with one exact SDK version pinned after M0 |
| Document state | tldraw store, including study tag metadata |
| Temporary UI state | React state, with Zustand only if shared UI state requires it |
| Bible database | better-sqlite3 in the main process |
| File access | Main-process filesystem operations and chokidar |
| Packaging | electron-builder, signed and notarized for macOS |

### 9.1 Custom shapes and bindings

Passages use a custom `PassageShapeUtil` with real DOM scripture text. Word elements expose the owning passage, full verse reference, and token index. The component supports native text selection and custom highlight interaction without forwarding those gestures to shape dragging.

Notes use a custom `NoteShapeUtil` with the supported fonts and sizes. Native shape rotation stores the chosen rotation in radians. The interface exposes degrees.

Arrows use the built-in arrow shape where possible. A word binding targets the passage shape and stores `WordBindingMetadata` in app-owned binding metadata. The exact field and validation hooks follow the pinned SDK.

The arrow must use precise interior targeting. The prototype verifies the SDK's `isPrecise`, `isExact`, and `normalizedAnchor` behavior so the terminal reaches the word rather than stopping at the passage boundary.

### 9.2 Layout and arrow geometry

- Convert pointer coordinates from screen space through the editor's transforms. Normalized anchors use passage-local coordinates.
- Resolve word identity before computing its geometry. Do not infer a target from a saved pixel location.
- Wait for bundled fonts before initial text measurement.
- Recompute affected word bounds after width, layout, font size, italics, or highlight weight changes.
- Account for overlays, pointer capture, scroll, zoom, and viewport culling.
- Retain valid measured geometry when the word's DOM is unavailable. Reconcile it when the passage returns. Moving an offscreen passage must preserve the binding.
- Batch geometry updates and avoid repeated writes caused by rounding differences.
- Derived geometry updates do not create undo entries, advance document timestamps by themselves, or trigger autosave loops.

The prototype must establish whether these requirements fit built-in arrow bindings. If the SDK cannot separate derived geometry from document edits, a custom binding or arrow implementation is resolved before the full app proceeds.

### 9.3 Focus, theme, and export

Reading focus lives in temporary UI state. Rendering applies object and verse dimming without persistent opacity changes. Any overlay must leave text selection, popovers, and word hit-testing functional.

Hide the default tldraw interface and supply Margin's toolbar, palette, and popovers. Theme the pinned SDK through its supported APIs and CSS tokens. A hobby-license watermark remains visible when required.

Export remains outside v1. Custom shape design must leave a path to explicit text and arrow export. Real DOM rendering alone does not guarantee a correct PNG, SVG, or PDF result.

### 9.4 Security and offline behavior

Use `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a strict CSP. The preload bridge exposes narrow, typed operations. Main-process handlers validate references and file requests and restrict file writes to the chosen library or app-private directories.

Bundle fonts, text, and application assets. v1 has no runtime network dependency. Future provider requests run in the main process through explicit provider operations.

### 9.5 Licensing and packaged-app prerequisites

Current tldraw production use requires an appropriate license. The hobby license requires approval and displays a watermark. License verification is local, but the packaged Electron build must be checked with its actual origin and key configuration.

Before committing to tldraw, record the selected SDK version, license approval, watermark requirements, expiration or renewal conditions, and packaged offline behavior. Development-mode behavior does not establish production licensing readiness.

Relevant upstream documentation:

- [tldraw hobby license](https://tldraw.dev/get-a-license/hobby)
- [tldraw license keys](https://tldraw.dev/sdk-features/license-key)
- [tldraw persistence](https://tldraw.dev/docs/persistence)
- [tldraw arrow binding options](https://tldraw.dev/examples/arrow-binding-options)

## 10. Delivery milestones and acceptance

### M0: Prove durable word annotations

Build a packaged Electron prototype with one passage, one note, highlights, and a word-bound arrow. Pin a candidate SDK version and verify licensing prerequisites.

M0 passes when all of these actions preserve the exact target word:

1. Attach an arrow to a word and highlight a nearby phrase.
2. Resize the passage until the target moves to a different line.
3. Change the layout, scripture size, italics setting, and highlight weight.
4. Pan the passage offscreen, move it, and bring it back.
5. Undo and redo the annotation and layout edits.
6. Save, close the app, and reopen it offline.
7. Open the study with a newer bundled corpus while preserving its stored text snapshot.

The prototype also proves that text selection works, derived geometry creates no undo or autosave noise, and the hand-drawn arrow appearance is achievable.

### M1: Build the library and saving workflow

Add the themed app shell, fonts, study list, first-use states, study metadata, document persistence, session camera restore, save indicators, migrations, and recovery.

Acceptance includes disk-write failure, pending saves on close, malformed input files, external file replacement, external deletion, dirty-document conflicts, stale library indexes, and study switching with retained undo history.

### M2: Bundle and resolve scripture

Add pinned KJV and JPS 1917 imports, provenance manifests, tokenizer fixtures, versification mapping, reference parsing, insertion previews, and passage controls.

Acceptance includes offline first launch, full source verse inventories, supplied-word italics, ambiguous references, unavailable translations, cross-chapter ranges, and numbering differences in Malachi, Joel, and Psalms.

### M3: Complete annotation editing

Add note options, word and note bindings, tags, partial highlight replacement, keyboard tagging, duplication, copy between studies, deletion, and document undo.

Acceptance includes partial-overlap splitting, duplicate-ID remapping, imported tags, dangling targets, keyboard access, IME input, and shortcut suppression during text editing.

### M4: Complete reading focus and release checks

Add passage focus, verse stepping, pull-out verses, explicit note associations, camera return behavior, reduced motion, and accessibility checks.

Acceptance includes long chapters at a readable scale, hidden verse numbers, connected annotations, interrupted camera moves, screen-reader passage order, and a signed offline installation.

### Later releases

| Release | Scope |
| --- | --- |
| v1.1 candidate | Canvas and selection export to PNG and PDF |
| v1.2 candidate | Cross-reference hover previews and insertion from note references |
| Later | Licensed providers after provider-specific rights and storage design |
| Later | S3 sync with explicit revision and conflict handling |
| Later | Global tag templates and search, comparison focus, freehand ink, and paper theme |

Parallel translation columns remain deferred. Separate blocks support comparison without coupling two translations' annotations inside one shape.

## 11. Decisions to verify before implementation expands

The product defaults in section 1.3 are settled for v1. The remaining prerequisites are evidence checks:

- Select and pin the exact KJV and JPS source editions and their rights metadata.
- Verify the versification map against those editions.
- Complete M0 and select the exact SDK version and binding implementation.
- Obtain the required tldraw license and validate its behavior in the packaged offline app.

These checks can change an implementation choice. They do not expand v1's product scope.