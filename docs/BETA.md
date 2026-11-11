# Beta launch priorities — 2026-11-07

Goal: a small group of testers can download Margin from the site, open it without
macOS warnings, study for weeks without losing work, receive fixes, and tell us
what broke.

Features are largely in place (M0–M4 work: passages, notes, word-bound arrows,
highlights and tags, focus, autosave/recovery/conflicts, offline KJV + JPS 1917,
word lookup). What remains is mostly shipping, updating, and trust.

## P0 — blocks inviting anyone

1. **Permanent tldraw licence that works in the packaged app.**
   The 14-day evaluation key expires **2026-11-21**; a build made with it stops
   working after that. The hobby key must have hosts `*` or the native flag with a
   pattern matching the app's `file://` URL; a domain-only key blanks the canvas.
   Verify with `yarn dist` + `e2e/packaged.e2e.ts`. Fallback if approval stalls:
   ask tldraw for an extended evaluation for the beta period.
2. **Signing and notarization.** Apple Developer ID, hardened runtime,
   entitlements for Electron and the unpacked `.node` modules, `notarize` config,
   stapling. Without this, Gatekeeper blocks a downloaded app. Test a signed
   install on a clean Mac with networking off (SPEC M4).
3. **Updates.** Testers need fixes without hunting for new DMGs. Add
   `electron-updater` against a static feed (GitHub Releases or R2), signed builds
   only. Updates are the one deliberate network request; it must be explicit
   (main process, CSP unchanged for the renderer) and the app must work fully
   when the check fails. At minimum: a manual "Check for updates…" menu item.
4. **Study files survive upgrades.** Every beta build must open studies written
   by every earlier beta build. Freeze the study envelope at version 1 for beta,
   add a fixture study from today's build to the test suite, and require a
   migration plus test for any later schema change.
5. **Downloads and the site.** Host the DMG/ZIP, set `site.downloadUrl`, deploy
   the site (`site/wrangler.jsonc`). Decide Apple silicon only vs universal; the
   x64 prebuilds are already kept. Set `LSMinimumSystemVersion` (vibrancy fallback
   below macOS 26 needs a real check on an older Mac).
6. **Feedback channel.** Help menu: "Send feedback…" (mailto or GitHub issue with
   app version, macOS version, and arch prefilled) and "Reveal logs". No
   telemetry; this keeps the offline promise.

## P1 — before widening the beta

7. **Acknowledgements and licences in the app.** An About/Acknowledgements view:
   KJV and JPS 1917 provenance, Open Scriptures lexicon (CC BY-SA 3.0 attribution),
   font OFLs, tldraw. The texts ship in `resources/` but users can't see them.
8. **Version and metadata.** `version` is `1.0.0`; set `0.9.0-beta.1` (or
   similar) so updates and bug reports are traceable. Add `author`, copyright.
9. **CI.** Clean-checkout `yarn install --frozen-lockfile`, typecheck, lint,
   unit tests, `yarn dist`, `yarn test:e2e` including the packaged test. The
   licence key comes from a CI secret.
10. **Live checks of focus mode.** Camera and dimming were verified through pure
    tests only (`docs/status/focus.md`). Add e2e coverage: focus a long chapter,
    step verses, pull out a verse, Esc ladder, reduced motion.
11. **First run.** A tester opening an empty app should reach "passage on canvas
    with a note and an arrow" without instructions. Review the empty states,
    starter tags, and shortcut discoverability (palette lists shortcuts).
12. **App size.** 455 MB installed, DMG ~129 MB, mostly Electron and the Bible DB.
    Re-measure after the DB shrink; acceptable for beta, but note it on the site.

## P2 — small gaps worth closing during beta

- Settings UI for the Old Testament translation (`oldTestamentTranslation` is
  stored and used, but not exposed).
- A toolbar control for the current highlight colour.
- Accessibility pass: VoiceOver passage order (canvas DOM is z-order; the
  sidebar list is the scripture-ordered path), focus rings, contrast in light mode.
- Tidy `docs/STATUS.md`: its Foundation section predates most of the app.

## After beta (already planned in SPEC)

PNG/PDF export (v1.1), cross-reference previews (v1.2), licensed translations,
sync, global tags.

## Decisions needed

- Apple Developer Program membership (needed for P0.2).
- Update and download host: GitHub Releases (public repo) or R2/Pages.
- Apple silicon only, or universal.
- Beta size and how testers are invited (site sign-up vs direct link).
