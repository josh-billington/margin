# Margin app icon

Two editable sources, both the liquid-glass treatment of the open book: `margin.svg` (paper, ivory tile) and `margin-dark.svg` (night, dark tile). The launch video keeps its own copies in `video/public/`. `margin-refined.svg` preserves an earlier, more formal flat version.

Rebuild the PNGs, the website favicon and the macOS icons with `node apps/desktop/scripts/export-icon.mjs <path to node_modules/sharp>` from the repository root (or set `SHARP_PATH`). Sharp is not a project dependency: install it anywhere, for example `npm install sharp` in a scratch folder. Creating the `.icns` files requires macOS `iconutil`.

The macOS bundle uses `margin-dark.icns`; development builds set the Dock icon from `margin-dark-1024.png`. The website favicon is the night tile, copied to `site/app/icon.svg`. The header and footer use an inline SVG in `site/components/logo.tsx`, drawn for 32px display.

The iPad icon in `apps/ipad/ios/App/App/Assets.xcassets/AppIcon.appiconset` is still the earlier artwork: iOS needs a square, fully opaque 1024px image, so it needs a full-bleed export of these sources rather than the rounded tile.
