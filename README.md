# GymTrak — Workouts

A personal, **offline-first, installable** workout tracker for a 6-day **ULULUL split**
(Upper A → Lower C, Mon–Sat, Sunday rest). No accounts, no server: it runs entirely
in the browser, works with zero signal in a gym basement, and installs to the home
screen like a native app.

Core loop: open → today's session is front and center → start it → tick off prefilled
sets (one tap each, loads carry over from last time) → finish. Plus History, Progress,
and a Library of all six days.

## Stack

| Layer | Choice |
|---|---|
| Build / framework | Vite + React + TypeScript (SPA) |
| Offline + installable | `vite-plugin-pwa` (Workbox service worker + manifest) |
| Local storage | Dexie.js (IndexedDB) |
| Reactivity | `dexie-react-hooks` (`useLiveQuery`) |
| Styling | Tailwind CSS v4 (mobile-first, design tokens in `src/index.css`) |
| Routing | React Router |
| Schemas / validation | Zod (`src/db/types.ts`) |
| Sync / backup (phase 2) | Supabase — not wired yet |

## Getting started

```bash
npm install
npm run dev          # http://localhost:5180 (dev)
npm run build        # typecheck + production build to dist/
npm run preview      # serve the production build (SW active here)
```

On first launch the app seeds your split (the six days + their exercises) plus some
demo history so History/Progress aren't empty. The seed only runs when the DB is empty
(`seedIfEmpty` in `src/db/seed.ts`); `resetAndReseed()` wipes and reseeds.

## Project structure

```
src/
  main.tsx              # entry: registers the SW, seeds, renders
  App.tsx               # routes: / /history /progress /library (tabbed) + /log (full-screen)
  index.css             # Tailwind + design tokens (@theme) + base component classes
  db/
    types.ts            # Zod schemas → inferred types (the record shapes)
    db.ts               # Dexie database + table indexes
    seed.ts             # the ULULUL catalog + demo history
  lib/
    rotation.ts         # today's day, "DAY N OF 6", next day
    format.ts           # clocks, volume, local-safe dates, load parsing
    stats.ts            # volume, streak, heatmap, calendar, weekly bars, body-weight series
    actions.ts          # start → toggle set → finish (volume + PR detection)
  hooks/useRestTimer.ts # background-correct 90s rest countdown (end-timestamp based)
  components/           # TabBar, Heatmap, ProgressRing, icons, AppLayout
  screens/              # Home, Log, History, Progress, Library
docs/design-reference/  # the original design handoff (source of truth — see below)
scripts/shot.mjs        # screenshot loop (drives headless Chrome, mobile viewport)
```

## Data model (Dexie / IndexedDB)

`days` · `exercises` · `sessions` · `sets` · `bodyWeight` · `prs`. Every record carries a
string UUID `id` and an `updatedAt` stamp, so the planned Supabase sync (last-write-wins)
is a bolt-on rather than a rewrite. Volume sums numeric `weight × reps`; machine "Max"
loads are excluded from volume (carried as the literal string).

## Offline & install

`vite-plugin-pwa` generates a service worker that precaches the app shell + assets, so the
app loads with no network after the first visit. The web manifest + icons make it
"Add to Home Screen"-able; it runs fullscreen (`display: standalone`). The SW is active in
the production build (`npm run preview` / deployed) — it's disabled in dev.

> Icons are SVG (`public/icon.svg`, `icon-maskable.svg`). For maximum install
> compatibility you may later want to add PNG 192/512 variants.

## Screenshot loop

`scripts/shot.mjs` drives the system Chrome over the DevTools protocol to snapshot any
route at a phone viewport — the build → look → fix loop, no device needed:

```bash
node scripts/shot.mjs                          # home
node scripts/shot.mjs / /history /progress /library /log
SHOT_W=430 SHOT_H=932 node scripts/shot.mjs /  # different viewport
```

Output lands in `.shots/`. `/log` is special-cased: it starts a session and ticks a set so
the rest timer + Finish button are visible.

## Design reference

`docs/design-reference/` holds the original handoff this app was built from: `README.md`
(the full spec — tokens, screens, interactions, the seed split) and `Workout App.dc.html`
(the interactive prototype; open in a browser). `support.js` / `ios-frame.jsx` are that
prototype's runtime/bezel and are **not** part of this app.

## Known gaps (from the handoff — not built yet)

- Editing weight/reps during a session (steppers) — sets are tick-only for now.
- Body-weight quick-log input sheet.
- Empty states / first-run onboarding.
- Settings (rest duration is hard-coded to 90s).
- Phase 2: Supabase sync/backup across devices.
