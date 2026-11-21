# Beta study compatibility

`beta-1.study.json` was generated with the running 0.9.0-beta.1 editor, not
hand-written JSON. The normal passage insertion, word selection, note-on-words,
tag creation, highlight tool, and autosave paths produced the file. The app was
closed to flush saves before copying it here.

It contains Amos 1:3–5 (KJV), Genesis 1:27 (WEB), a note and its word-bound arrow,
a sky-coloured Judgement tag highlight, and a plain amber highlight. All IDs,
scripture snapshots, and the tldraw schema are preserved exactly as saved.

Keep this fixture unchanged when the schema evolves. Add a migration and another
fixture test for every future schema change; all earlier beta studies must still
open with their annotations intact.
