# Margin website

The marketing site for Margin: a landing page (`/`) and a privacy page (`/privacy/`). It is a separate package from the app. Nothing here touches the app's `package.json` or `src/`.

Next.js (App Router) with Tailwind v4 and shadcn/ui, exported as plain static files (`output: 'export'`). Package manager: **pnpm** (`pnpm-lock.yaml`, version pinned in `packageManager`). Use pnpm here, not the repo's Yarn, so the two lockfiles stay independent.

## Develop

```sh
cd site
pnpm install
pnpm dev           # http://localhost:3000
```

## Build

```sh
pnpm build         # writes the static site to site/out/
pnpm dlx serve out # or: python3 -m http.server -d out 4460
```

`out/` is self-contained HTML, CSS, JS and images. It has no server code, cookies or third-party requests, and fonts are bundled: the system font plus a self-hosted Gochi Hand from `@fontsource`.

## Before launch

Fill in `lib/site.ts`:

- `url`: defaults to `https://margin-bible.pages.dev`. Set `NEXT_PUBLIC_SITE_URL` at build time when moving to a custom domain.
- `downloadUrl`: the signed `.dmg`. Until it is set, "Download for Mac" shows "coming soon" and scrolls to the follow section.
- `githubUrl`: the public repo or project page, for "Follow along on GitHub".
- `contactEmail`: shown on `/privacy/`.

## Deploy to Cloudflare Pages

The production site is https://margin-bible.pages.dev. `wrangler.jsonc` selects the `margin-bible` project and the `out/` build directory.

From `site/`, run:

```sh
pnpm run deploy
```

This builds the static site and uploads the current working tree to the production `main` deployment. Wrangler must be signed in to the Cloudflare account that owns the project. Sign in with `pnpm dlx wrangler@4.157.0 login` if needed.

For a custom domain, add the domain in the Cloudflare Pages dashboard. Set `NEXT_PUBLIC_SITE_URL` to that HTTPS origin when rebuilding:

```sh
NEXT_PUBLIC_SITE_URL=https://your-domain.example pnpm run deploy
```

The deployment contains only `site/out/`. App code, databases, and unsigned app packages are not uploaded.

## Components

The page sections start from Tailark blocks (MIT, [tailark/blocks](https://github.com/tailark/blocks), Mist kit, Radix base) installed with the shadcn CLI, then restyled to Margin's brand:

| File | Tailark block |
| --- | --- |
| `components/hero-section-2.tsx`, `components/header.tsx` | `mist-hero-section-2` (+ its header) |
| `components/features-5.tsx` | `mist-features-5` |
| `components/faqs-2.tsx`, `components/ui/accordion.tsx` | `mist-faqs-2` |
| `components/call-to-action-3.tsx` | `mist-call-to-action-3` |
| `components/footer-4.tsx` | `mist-footer-4` |
| `components/ui/button.tsx`, `components/logo.tsx` | `mist-button`, `mist-logo` |

`components.json` registers `@tailark-oss` at `https://oss-tailark.com/r/radix/{name}`, so `pnpm dlx shadcn@latest add @tailark-oss/mist-<block>` adds more. If that host is unreachable, build the registry from the Tailark repo and serve it locally. That is how these blocks were installed:

```sh
git clone --depth 1 https://github.com/tailark/blocks /tmp/tailark && cd /tmp/tailark
# script that writes getRegistryItem(name, "radix") for every index entry to /tmp/tailark-r/<name>.json
python3 -m http.server 4455 -d /tmp/tailark-r
# then temporarily point "@tailark-oss" at http://127.0.0.1:4455/{name}.json
```

Tailark's hosted `tailark.com/r/*` blocks need a paid plan. This site uses only the open-source registry.

The hand-built parts are `word-anchor-demo.tsx` (the live reflow demo), `anchors-section.tsx`, `principles.tsx`, `hero-frames.tsx`, `download-button.tsx` and `reveal.tsx`.

## Screenshots

Everything in `public/shots/` is a real screenshot of the app, in both appearances. The site follows the visitor's `prefers-color-scheme`: light ("paper") token values sit in a media query in `app/globals.css`, and every shot is a `<picture>` whose light source is the same name with `-light`. To recompose “They that trust in the LORD” (Psalm 125:1 KJV and Psalm 23 JPS 1917, with Trust, Zion and Steadfast tags, handwritten notes and word-bound arrows) and re-export the crops, run this from the repo root:

```sh
npx electron-vite build
unset ELECTRON_RUN_AS_NODE && node_modules/.bin/tsx site/scripts/capture.mts   # raw 2x PNGs in /tmp/margin-shots/raw/{dark,light}
python3 site/scripts/crop.py                                                   # writes public/shots/*.webp and *-light.webp
```

The capture launches the built app twice (appearance set to Dark, then Light, through the prefs IPC) with throwaway `MARGIN_USER_DATA_DIR` and `MARGIN_LIBRARY_DIR` and `MARGIN_GLASS=0`, and serves the renderer over http like `e2e/harness.ts`. It never touches `~/Documents/Margin`. The crop rects in `crop.py` cut off the bottom-right corner, where development builds show tldraw's "Get a license" notice, and they never cover product UI. The same export refreshes the dark Open Graph and Twitter previews, fitted to keep every note in frame.

`lookup.webp` and `lookup-light.webp` show the Strong’s entry for “trust” in Psalm 125:1. The additional `lookup-bdb` pair uses the same word with Brown-Driver-Briggs selected, captured from the BDB branch. Build that checkout first, then run the main checkout's capture script with `CAPTURE_REPO=/path/to/bdb-checkout CAPTURE_BDB=1 SHOTS_DIR=/tmp/margin-shots/bdb`. This keeps the main raw captures separate; copy the two `lookup-bdb.png` files into the corresponding `/tmp/margin-shots/raw/{dark,light}/` directories before running `crop.py`.

`scripts/screenshot-site.mts` takes desktop and mobile full-page screenshots of the built site, in light and dark, for review.
