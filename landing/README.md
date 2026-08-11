# GymPal landing page

A single hand-authored static page (`index.html` + `styles.css`, no build step, no dependencies)
that gives GymPal a public shopfront. Built for G41.

## Why static

A marketing page has no state, no routing and no data fetching, so a build toolchain would add
`node_modules` and a deploy step for zero benefit. An Expo web export was rejected outright — it
ships the whole mobile app bundle (navigation, sockets) to render a brochure.

## Brand tokens

Colours are copied **by value** from `../constants/Theme.js` into CSS custom properties at the top
of `styles.css`, so this page matches the app without importing React Native code:

| token | value | source |
|---|---|---|
| `--gold` | `#FFD700` | `Theme.colors.primary` |
| `--gold-dark` | `#B39700` | `Theme.colors.primaryDark` |
| `--bg` | `#050505` | `Theme.colors.background` |
| `--surface` | `#161616` | `Theme.colors.surface` |
| `--text-2` | `#B3B3B3` | `Theme.colors.textSecondary` |

⚠️ `PROJECTS.md` in the backlog repo records the brand gold as `#F6B000`. That is **stale** —
`Theme.js` is the source of truth and says `#FFD700`. If the official gold really is `#F6B000`,
change `--gold` here and fix `PROJECTS.md`.

## Screenshots

There are none. The repo has no `assets/` folder and no captures exist, so the phone frames on this
page are **pure CSS mockups** — the agreed G41 §8 fallback, chosen deliberately rather than shipping
a broken `<img>`. They depict real screens (live session logging with the rest timer and PR banner;
the trainer roster with 7-day RAG chips) but they are illustrations, not screenshots.

Swap them for real captures when they exist: replace the `.phone` blocks in `index.html` with
`<img>` tags and drop the files in `landing/assets/`.

## Copy accuracy

Two things the copy deliberately does **not** say:

- **"RAG" is not AI.** In this codebase RAG means the Red/Amber/Green 7-day compliance chip on the
  trainer dashboard (G28). It is not retrieval-augmented generation. Do not let that drift.
- **There is no app-distribution link.** No `eas.json` exists and the app is not published, so the
  page carries only the GitHub CTA. A dead "Download" button is worse than none. When a build is
  published, add the CTA next to "View the source".

## Local preview

```bash
cd landing
python -m http.server 8080
# → http://localhost:8080
```

## Deploy (Vercel)

The page is plain static files, so any host works. For Vercel:

1. Import the `GibbHubb/GymPal` repo.
2. Framework preset: **Other**.
3. Root directory: **`landing`**.
4. Build command: leave empty. Output directory: leave empty (or `.`).
5. Deploy.

No `vercel.json` is needed — with the root directory set to `landing`, Vercel serves the folder as
static files. The repo's default branch will auto-redeploy on push.
