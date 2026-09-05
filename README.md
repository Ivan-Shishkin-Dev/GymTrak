# GymTrak

A personal workout tracker I built for myself. It runs in the browser, works offline, and installs to your phone like an app. Anyone with the link can view my training log; only I can edit it, gated by a password. No accounts, no login.

## Why I built it

I tried a bunch of gym apps and none of them did quite what I wanted. Most paywall the parts that are actually useful, bury logging under menus, or push their own idea of a program onto you. I wanted something simple that matched my real split, prefilled what I lifted last time, and that I fully owned — no subscription, no account, my data. So I wrote my own. It does exactly what I need and nothing I don't, and I keep changing it as my training changes.

## What it does

- **It knows what today is.** Home shows the current week of my training program and what that day actually asks for — a lift, a run, both, or rest. The week is anchored to a start date, so it advances on its own. I can still tap any other day and start that instead.
- **History closes the loop.** Completed lifts and runs are grouped by date with full set details, planned-versus-actual run metrics, recent training time, prior-performance context, and automatic best-load markers.
- **Runs are first-class.** Easy and long runs are scheduled with a duration and a heart-rate zone, and logged on their own screen: a clock against the prescribed time, with average HR recorded at the end. Going over the hard cap flags the session; it never blocks saving it.
- **Minutes, shown in miles.** Runs are prescribed in minutes — that's the point of a Zone 2 block, since the same heart rate buys more distance as fitness comes in. Every duration is also shown as the distance it works out to at my measured Zone 2 pace (2.5 mi in 30 min → 12:00 /mi). Logging the miles I actually covered shows the pace I really held, so the estimate can be corrected rather than assumed.
- **Log it set by set.** Each set comes prefilled with what I did last time — tap to mark it done, or edit the weight/reps to what I actually hit.
- **Focused by default.** Live lifting shows the current exercise first, provides one-tap load adjustments, and keeps the full workout one tap away in Overview.
- **Loads carry forward.** Finishing a workout writes completed performance back to the Plan, so next time prefills from reality instead of a guess. Unfinished targets and deliberate deload volume are preserved, so ending early never quietly shrinks the next workout.
- **The plan is editable.** Plan holds the split: add, rename, and reorder days; add, edit, reorder, and remove exercises; set per-set loads (top set plus back-offs). Each exercise is independent — same-named lifts on other days progress on their own.
- **The schedule is editable too.** Current and future weeks can change lift/run/rest assignments, run duration and heart-rate targets, deloads, and strides; past weeks stay locked, and any week can seed the next one.
- **Different kinds of load.** Free weight, machine stack/level, plate count, bodyweight (added or assisted), or free text. Each exercise pins how its weight is written so the notation never drifts set to set.
- **Public to read, password to edit.** The whole log is open to view. Editing asks for a password; enter it once and you're in edit mode for the session. Everything syncs to the cloud, so it's the same on my phone and laptop.
- **Old plans are archived, not deleted.** Consolidating the split hides the previous days rather than removing them, so every past workout still resolves and rolling back is one tap.
- **Works offline.** It's a PWA — loads with no signal after the first visit, installs to the home screen, runs fullscreen.
- **Gym-safe timers and recovery.** Rest survives reloads, signals time with vibration/sound, supports per-exercise targets, and keeps the screen awake during an open session. Finishing has a short Undo, and cloud replacement creates a local recovery copy.

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

On first launch it seeds the split (the four lift days and their exercises) plus the eight-week running base phase, anchored to the upcoming Monday, into IndexedDB. After that your data lives locally and, if configured, syncs to Supabase last-write-wins by timestamp.

The seed only runs on an empty database, so it can't reach an install that already has data. There the same split and program are installed from **Plan → Edit → Program → Install base phase**, which is idempotent: re-running it never duplicates a week and never resets a load you've since progressed. Archiving the previous six-day split and removing its `Cardio` line item are separate, confirmed actions in the same card; archived days stay in the database so every past workout still resolves.

## Project structure

```
src/
  main.tsx        registers the service worker, starts sync, renders
  App.tsx         routes: /, /history, /library (tabbed) + /log and /run (full-screen)
  index.css       Tailwind + design tokens + base component styles
  db/
    types.ts      Zod schemas → inferred record types
    db.ts         Dexie database + indexes (days · exercises · sessions · sets · programWeeks)
    templates.ts  the split (four lift days) + the base-phase weeks, as data
    seed.ts       first-launch seed: builds an empty database from the templates
    program.ts    the idempotent installer/migration for a database that has data
  lib/
    rotation.ts   day ordering helpers
    program.ts    the calendar: which week and weekday today is, run copy
    session.ts    lift-vs-run session helpers
    load.ts       the load grammar (parse/format each load type)
    format.ts     clocks, local-safe dates, set rows
    actions.ts    start → toggle/edit set → finish; library edits; load carry-over
    supabase.ts   the anon client (no auth)
    sync.ts       snapshot serialize/apply, edit mode, push/pull
  components/      AppLayout, TabBar, WeekList, IdentityGate, SyncBar, LoadEditor, …
  screens/        Home, History, Library, Log, Run
scripts/shot.mjs  screenshot loop (headless Chrome at a phone viewport)
```

## Deploy

It's a static SPA. I host it on Vercel; `vercel.json` rewrites every route to `index.html`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project's environment variables, then redeploy (env changes only apply to new builds). The build also accepts the `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` names that Vercel's Supabase integration sets automatically.

## Status

This is a personal project for my own training. It's not meant to be a general-purpose product — I add and change things as I need them.
