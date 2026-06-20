# GymTrak — Workouts

A personal, **offline-first, installable** workout tracker for a 6-day **ULULUL split**
(Upper A → Lower C). No accounts, no server: it runs entirely
in the browser, works with zero signal in a gym basement, and installs to the home
screen like a native app.

Core loop: open → the next workout in the cycle is front and center (override the pick with a
day chip if you want a different one) → start it → tick off prefilled sets (one tap each, edit any
set's weight/reps to what you actually hit, jot a note on any set) → finish. Finishing carries each
lift's top set back to the Library, so loads always prefill from what you last did. The Home screen also has a plain
notepad. History is a tappable calendar — tap a date to see what you hit and your per-set notes.
The Library is editable in place — add, remove, and rename days, edit/add/remove exercises, and set
a different weight/reps per set (top set + back-offs), which prefill each workout and update as you train.

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
demo history so History isn't empty. The seed only runs when the DB is empty
(`seedIfEmpty` in `src/db/seed.ts`); `resetAndReseed()` wipes and reseeds.

## Project structure

```
src/
  main.tsx              # entry: registers the SW, seeds, renders
  App.tsx               # routes: / /history /library (tabbed) + /log (full-screen)
  index.css             # Tailwind + design tokens (@theme) + base component classes
  db/
    types.ts            # Zod schemas → inferred types (the record shapes)
    db.ts               # Dexie database + table indexes
    seed.ts             # the ULULUL catalog + demo history
  lib/
    rotation.ts         # next workout in the cycle, "DAY N OF 6"
    format.ts           # clocks, local-safe dates, load parsing
    stats.ts            # month calendar + session-on-a-date lookup
    actions.ts          # start → toggle/edit set → finish (carries top sets back to Library); notes, library edits
  hooks/useRestTimer.ts # background-correct, adjustable rest countdown (end-timestamp based)
  components/           # TabBar, ProgressRing, icons, AppLayout
  screens/              # Home, Log, History, Library
scripts/shot.mjs        # screenshot loop (drives headless Chrome, mobile viewport)
```

## Data model (Dexie / IndexedDB)

`days` · `exercises` · `sessions` · `sets` · `notes`. Each set can carry a free-text
`comment` (the note added after a set, surfaced in History). Every record carries a
string UUID `id` and an `updatedAt` stamp — and `notes` soft-delete via `deleted` — so the
planned Supabase sync (last-write-wins) is a bolt-on rather than a rewrite.

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
node scripts/shot.mjs / /history /library /log
SHOT_W=430 SHOT_H=932 node scripts/shot.mjs /  # different viewport
```

Output lands in `.shots/`. `/log` is special-cased: it starts a session and ticks a set so
the rest timer + Finish button are visible.

## Known gaps (not built yet)

- Empty states / first-run onboarding.
- A general Settings screen — rest length is adjustable in the Log footer (60/90/120/180s, persisted), but nothing else is configurable yet.
- Phase 2: Supabase sync/backup across devices.
