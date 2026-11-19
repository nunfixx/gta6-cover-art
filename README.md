# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/nunfixx/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/nunfixx/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Neon Cover Studio** — a web app that turns your photos into GTA VI-style cover art: a multi-panel poster with bold caption lettering and a Vice City sunset or neon colour grade, exported as a PNG to share. It runs fully offline in a desktop browser from its own static files; your photos are read on your own machine and never uploaded.

What it does:

- **Any photo** — drop in your own photos (or start with the three built-in demo scenes), fill one, three or four panels with one photo or several, and crop and position each panel by dragging, scrolling, or with the sliders.
- **Three layouts** — Poster (hero photo up top, two panels below), Four panel (two by two, title across the middle), and Hero (one full-bleed photo).
- **Four grades** — Sunset, Neon, Noir and Clean, applied live to every panel.
- **Bold lettering** — a big Anton title with subtitle in Bebas Neue, colour swatches, size slider, top or bottom placement, finished with film grain and a vignette drawn into the cover itself.
- **Fast** — photo to PNG in a few clicks, in 1080 × 1080, 1080 × 1350 or 1920 × 1080, one at a time or all three at once.

Everything is original: the demo photos are flat-vector scenes drawn procedurally for this app, the fonts are SIL OFL (Anton and Bebas Neue, shipped under `app/fonts/`), and no Rockstar Games logo, artwork, character or font is used anywhere.

## Run it

```sh
python3 -m http.server 8080 --directory app
# open http://localhost:8080 in desktop Chrome
```

Or serve `app/` with any static file server. No build step, no network request: every script, font and image is a file under `app/`.

## Shots

`?shot=cover&layout=poster&size=landscape&photo=sunset-city&caption=VICE%20CITY` renders a fixed cover scene for screenshots; `?shot=editor` opens the editor with the demo photos loaded. The app exposes `window.__vice.exportDataURL(size)` for its own screenshot harness.

---

<sub>Entered on [make.fun](https://make.fun/?ref=pqrphsn3&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
