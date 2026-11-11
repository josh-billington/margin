# Margin app icon

`margin.svg` is the editable source. The current mark uses hand-drawn paths and flat fills; no generated imagery, external fonts, or blur filters. `margin-refined.svg` preserves the earlier, more formal version.

Rebuild the PNGs, website favicon, and macOS icon with `node scripts/export-icon.mjs` from the repository root. The exporter uses Sharp from the website's installed dependencies (`cd site && npm install`). Creating the `.icns` requires macOS `iconutil`.

The macOS bundle uses `margin-dark.icns`; development builds set the Dock icon from `margin-dark-1024.png`. The website favicon uses the exported `site/app/icon.svg`. The header and footer use an inline, filter-free SVG in `site/components/logo.tsx`, drawn for 32px display.

The exporter also produces `margin-dark.svg`, `margin-dark.icns`, and 256px/1024px dark PNGs. This alternate charcoal tile preserves the ivory pages and blue details; the light icon remains the default.
