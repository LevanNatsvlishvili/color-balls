# Portfolio packaging

Phase 6 wrapper for showcasing the playable ad on a personal portfolio site.

## Contents

| File | Purpose |
|------|---------|
| `index.html` | Phone-frame wrapper with orientation toggle, build blurb, and demo tabs |
| `playable.html` | Generated single-file ad (from `dist/index.html`) |
| `build-stats.json` | Generated gzip/raw size stats for the sidebar |
| `demo.mp4` | Optional 15s screen capture fallback for desktop visitors |

## Build

```bash
npm run build:portfolio
```

Copies the production bundle to `playable.html` and writes current size stats.

## Local preview

```bash
npm run preview:portfolio
```

Opens the wrapper at `http://localhost:4174`.

## Deploy

Host the entire `portfolio/` folder on any static host (GitHub Pages, Netlify, S3, etc.).

1. Run `npm run build:portfolio` so `playable.html` and `build-stats.json` exist.
2. Upload or publish the `portfolio/` directory.
3. Point your portfolio link to `index.html`.

For GitHub Pages from `/docs` or a `gh-pages` branch, copy the built portfolio folder contents to that publish root.

## Demo video (optional fallback)

Record a ~15 second capture of a full run (through CTA) for recruiters who won't interact:

1. Start `npm run preview:portfolio`.
2. Open `http://localhost:4174/playable.html` full screen.
3. Record with OBS, ShareX, or OS screen capture.
4. Trim to ~15s, export as H.264 MP4.
5. Save as `portfolio/demo.mp4`.

The wrapper's **Watch demo** tab autoplays the video (muted, looped). If the file is missing, a placeholder message appears.

## Test URLs

- Interactive wrapper: `/index.html`
- Raw playable: `/playable.html`
- CTA shortcut: `/playable.html?state=cta`
