# GymTrak

A personal workout tracker I built for myself. It runs in the browser, works offline, and installs to your phone like an app. Anyone with the link can view my training log; only I can edit it, gated by a password. No accounts, no login.

## Why I built it

I tried a bunch of gym apps and none of them did quite what I wanted. Most paywall the parts that are actually useful, bury logging under menus, or push their own idea of a program onto you. I wanted something simple that matched my real split, prefilled what I lifted last time, and that I fully owned — no subscription, no account, my data. So I wrote my own. It does exactly what I need and nothing I don't, and I keep changing it as my training changes.

## What it does

- **Pick a day, start, log it.** The app suggests the next day in my rotation, but I can start any of them. Each set comes prefilled with what I did last time — tap to mark it done, or edit the weight/reps to what I actually hit.
- **Loads carry forward.** Finishing a workout writes each lift's top set back to the Library, so next time prefills from reality instead of a guess.
- **The plan is editable.** The Library holds the split: add, rename, and reorder days; add, edit, reorder, and remove exercises; set per-set loads (top set plus back-offs). Exercises with the same name across days are linked, so updating one updates all of them.
- **Different kinds of load.** Free weight, machine stack/level, plate count, bodyweight (added or assisted), or free text. Each exercise pins how its weight is written so the notation never drifts set to set.
- **Public to read, password to edit.** The whole log is open to view. Editing asks for a password; enter it once and you're in edit mode for the session. Everything syncs to the cloud, so it's the same on my phone and laptop.
- **Works offline.** It's a PWA — loads with no signal after the first visit, installs to the home screen, runs fullscreen.

## How access control works

There are no accounts. All the data lives in a single Supabase row as one JSON blob:

- **Reading** is open to everyone (Row-Level Security allows public reads).
- **Writing** is blocked at the database level. The only write path is a `save_state` Postgres function that checks an edit password (bcrypt, server-side) before saving. The password never ships in the app.
- The anon key and the data are public by design. The password is the only thing gating edits.

Without the password the app is read-only. Enter it and you flip into edit mode for the browser session.

## Stack

| Layer | Choice |
|---|---|
| Framework / build | React + TypeScript + Vite (SPA) |
| Offline + installable | `vite-plugin-pwa` (Workbox service worker + manifest) |
| Local storage | Dexie.js over IndexedDB |
| Reactivity | `dexie-react-hooks` (`useLiveQuery`) |
| Styling | Tailwind CSS v4 (design tokens in `src/index.css`) |
| Routing | React Router |
| Schemas | Zod (`src/db/types.ts`) |
| Cloud sync | Supabase (public read, password-gated write via RPC) |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # typecheck + production build → dist/
npm run preview  # serve the build (service worker is active here)
```

Cloud sync is optional locally. Copy `.env.example` to `.env` and fill in your Supabase URL and anon/publishable key to turn it on. Without it the app still runs fully offline against local storage — it just won't sync.

On first launch it seeds the split (the six days and their exercises) into IndexedDB. After that your data lives locally and, if configured, syncs to Supabase last-write-wins by timestamp.

## Project structure

```
src/
  main.tsx        registers the service worker, starts sync, renders
  App.tsx         routes: / and /library (tabbed) + /log (full-screen)
  index.css       Tailwind + design tokens + base component styles
  db/
    types.ts      Zod schemas → inferred record types
    db.ts         Dexie database + indexes (days · exercises · sessions · sets)
    seed.ts       the 6-day split catalog
  lib/
    rotation.ts   suggested next day, day ordering
    load.ts       the load grammar (parse/format each load type)
    format.ts     clocks, local-safe dates, set rows
    actions.ts    start → toggle/edit set → finish; library edits; load carry-over
    supabase.ts   the anon client (no auth)
    sync.ts       snapshot serialize/apply, edit mode, push/pull
  components/      AppLayout, TabBar, CycleRail, IdentityGate, SyncBar, LoadEditor, …
  screens/        Home, Library, Log
scripts/shot.mjs  screenshot loop (headless Chrome at a phone viewport)
```

## Deploy

It's a static SPA. I host it on Vercel; `vercel.json` rewrites every route to `index.html`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project's environment variables, then redeploy (env changes only apply to new builds). The build also accepts the `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` names that Vercel's Supabase integration sets automatically.

## Status

This is a personal project for my own training. It's not meant to be a general-purpose product — I add and change things as I need them.
