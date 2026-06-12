# Handoff: Personal Workout PWA ("Workouts")

## Overview

A single-user workout logging app for a 6-day ULULUL split (Upper A → Lower C, Mon–Sat, Sunday rest). Core loop: open app → see today's session front and center → start it → tick off prefilled sets (one tap each) → finish. Supporting screens: history (calendar + sessions), progress (body weight, weekly volume, PRs), and a library of all 6 workout days.

No accounts, no social, no server in phase 1. Installable PWA, offline-first.

## About the Design Files

The files in this bundle are **design references created in HTML** — interactive prototypes showing intended look and behavior, **not production code to copy directly**. The task is to recreate these designs in the target stack (below) using its patterns. `Workout App.dc.html` is the master design file; `ios-frame.jsx` is only a device-bezel used for presentation and should NOT be implemented.

The design canvas contains: (1) the interactive prototype — this is the source of truth, and (2) three home-screen variations — **V2 "Volt hero" was chosen** and is already rolled into the prototype's home screen. V1/V3 are explorations only; ignore them for implementation.

## Target stack (already decided by the owner)

| Layer | Pick |
|---|---|
| Build/framework | Vite + React + TypeScript |
| Offline + installable | vite-plugin-pwa (Workbox) |
| Local storage | Dexie.js (IndexedDB) |
| Reactivity | dexie-react-hooks (`useLiveQuery`) |
| Styling | Tailwind CSS (mobile-first) |
| Routing | React Router |
| Schemas/validation | Zod |
| Sync/backup (phase 2) | Supabase |

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, and copy are final. Recreate pixel-perfectly with Tailwind (extend the theme with the tokens below). All data shown in the prototype is mock/seed data — the real app reads from Dexie.

## Design Tokens

Suggested Tailwind theme extensions:

### Colors
| Token | Value | Use |
|---|---|---|
| `bg` | `#060607` | App background |
| `card` | `#131316` | All cards, pills, tab bar base |
| `card-border` | `rgba(255,255,255,0.07)` | 1px border on every card |
| `pill-border` | `rgba(255,255,255,0.08)` | 1px border on circular buttons |
| `text` | `#F4F4F5` | Primary text |
| `sub` | `#8E8E93` | Secondary text |
| `faint` | `#6F6F75` | Hint text (e.g. carry-over note) |
| `dim` | `#5A5A5F` | Weekday letters, chevrons |
| `idle` | `#56565C` | Inactive tab icons |
| `future` | `#3D3D42` | Future calendar days |
| `volt` | `#CDF463` | THE accent: actions, progress, today |
| `on-volt` | `#15170A` | Text on volt backgrounds |
| `volt-tint` | `rgba(205,244,99,0.1)` | Chip backgrounds (e.g. "−2.1 lb" badge) |
| `track` | `rgba(255,255,255,0.1)` | Rest-timer track, bar-chart base `0.16` |
| `ring-off` | `rgba(255,255,255,0.13)` | Unfilled portion of progress rings |
| `check-border` | `rgba(255,255,255,0.22)` | Unchecked set circle border |
| `separator` | `rgba(255,255,255,0.06)` | List row separators |
| `dot-off` | `rgba(255,255,255,0.10)` | Heatmap rest-day / empty dots |
| `dot-on` | `rgba(255,255,255,0.45)` | Heatmap workout dots (`0.95` for standout sessions) |

Volt is the **only** accent. It always means "action or progress" (start button, rest timer, today, PR badges, current-week bar, done checks). Everything else stays monochrome.

### Typography
System font stack throughout: `-apple-system, 'SF Pro', system-ui, sans-serif`. Numbers that update (timers, weights, dates) use `font-variant-numeric: tabular-nums`.

| Style | Size / weight / tracking |
|---|---|
| Screen title ("Workouts", "History"…) | 34px / 760 / −0.02em |
| Hero workout name ("Upper C") | 27px / 740 / −0.02em |
| Big stat (186, 61.4k) | 28px / 720 / −0.02em (38px on old layout; 34px on Progress body weight) |
| Card stat (61,420) | 26px / 720 / −0.02em |
| Card title | 15px / 640 |
| Row title | 14.5px / 600 |
| Body / row value | 13.5–14px / 400–600 |
| Secondary | 13px / 400, color `sub` |
| Micro label (FRIDAY — DAY 5 OF 6, REST, UP NEXT) | 11px / 600–700 / +0.12em, uppercase, monospace (`ui-monospace, 'SF Mono', Menlo`) for the hero label |
| Buttons | 16px / 700 |

### Spacing, radius, shadows
- Screen padding: 20px horizontal; 74px top (under status bar); 130px bottom (clears tab bar).
- Card gap: 14px between cards (flex column with `gap`).
- Radius: hero card 30px; standard card 26px; list/exercise card 22px; buttons & timer pill 26px (fully rounded at 52px height); PR chip 6px; tab bar 32px.
- No shadows inside the app — depth comes from the 1px borders on `#131316` over `#060607`.
- Tab bar: floating, 24px from edges/bottom, 62px tall, `rgba(19,19,22,0.92)` + `backdrop-blur(20px)`, border `pill-border`.

## Screens / Views

Routes (React Router): `/` home, `/log` active session, `/history`, `/progress`, `/library`. Tab bar visible on all except `/log`.

### 1. Home (`/`) — "Volt hero" layout
Top to bottom (flex column, gap 14):
1. **Header row**: "Workouts" (34px) left; right: 44px circular card-style button with a plus glyph → starts today's session.
2. **Hero card** (radius 30, padding 24, gap 20):
   - Monospace micro label: `FRIDAY — DAY 5 OF 6` (computed: weekday + position in the 6-day rotation).
   - Row (gap 18): 68px progress ring (conic: volt for completed fraction of the week — 64% shown — over `ring-off`; 56px inner circle `card` bg with the rotation number "1" at 22px/680) + column: workout name "Upper C" (27px) and exercise preview "Dip · Pulldown · Press · Low row +3" (13.5px `sub`).
   - **Start workout** button: full-width, 52px, volt bg, `on-volt` text, 16px/700 → navigates to `/log`.
3. **Stat grid** (2 cols, gap 14): Body weight card ("186 lbs" 28px + "Body weight · today" 13px `sub`) and Volume card ("61.4k lbs" + "Volume · 7 days"). Both → `/progress`.
4. **Consistency card**: header row "Consistency" (15px/640) + "9-week streak · next: Lower C" (12px `sub`); 3-month dot heatmap (see Heatmap component). → `/history`.
5. **PR row card** (padding 16/20): volt `PR` chip (10px/800, radius 6, padding 3px 6px) + "Bench 230 × 3" + "Mon" right-aligned `sub`. → `/progress`.

### 2. Log workout (`/log`)
Full-screen flow, no tab bar. Layout: fixed header, scrollable set list, fixed footer.
- **Header** (padding 70px 20px 12px): 40px circular back button (chevron) → home; center column: "Upper C" (20px/700) + "Shoulder lean · 3 of 14 sets" (12.5px `sub`, live count); right: elapsed-time pill (16px/640 tabular, card bg, fully rounded, padding 8px 14px) counting up from 0:00.
- **Hint line**: "Loads carried over from Fri, Jun 5 — tap the circle when a set is done" (12px `faint`).
- **Exercise cards** (radius 22, padding ~8px 18px 12px), one per exercise: title row = name (15px/640) left, carry-over note (11.5px `sub`) right. Then one row per set, 46px tall: `Set 1` (12px `sub`, 42px wide) · weight (16px/620, flex 1, tabular) · reps "× 6" (14px `sub`) · 28px check circle (1.5px `check-border` border; checked = volt fill, `on-volt` ✓, row opacity 0.45).
- **Footer** (top border `card-border`, bg `rgba(10,10,11,0.92)`, padding 14px 20px 30px):
  - **Rest timer** (visible while resting): `REST` label (11px/700 volt, +0.1em) · countdown `1:30` (16px/700 tabular) · 4px progress track (volt fill, width = remaining/90) · "Skip" text button (13px/600 `sub`).
  - **Finish workout** button (appears once ≥1 set done): full-width 52px volt, → saves session, resets, navigates home.

### 3. History (`/history`)
1. Title "History".
2. Stat grid (2 cols): "5 / 6 · Sessions this week" and "9 wks · Current streak" (24px/720 stat + 13px `sub` label).
3. **Calendar card**: header "June 2026" + "26 of 30 planned" (12px `sub`); weekday letters M T W T F S S (11px `dim`); 7-col grid, gap 4, 36px circular day cells (13px tabular): past workout day = `rgba(255,255,255,0.10)` bg + `text`; today = volt bg + `on-volt` + 700; rest day = plain `#5E5E63`; future = `future`.
4. **Recent sessions card**: rows 56px (name 14.5/600 + "Yesterday · 48 min" 12.5 `sub`; right: volume "9,840 lb" 13.5 `sub` tabular), 1px separators, none on last row.

### 4. Progress (`/progress`)
1. Title "Progress".
2. **Body weight card**: header row "Body weight" + volt-tint chip "−2.1 lb this month" (11.5px/600 volt, fully rounded, padding 4px 9px); "186.4 lbs" (34px/740 tabular); 56px sparkline (2px volt polyline, opacity 0.9, 3.5px volt dot on last point) over 12 weekly data points; month axis labels Mar–Jun (11px `dim`).
3. **Weekly volume card**: header "Weekly volume" + "**61,420 lbs** last 7 days"; 8 bars (flex, gap 6, max height 64px, radius 3): past weeks `rgba(255,255,255,0.16)`, current week volt; axis labels "8 wks ago" / "This week".
4. **Recent PRs card**: rows 50px: volt `PR` chip + lift name (14.5/600) + load "230 × 3" (14/640 tabular) + date (12.5 `sub`, right). A PR is detected when a logged set beats the stored best for that exercise (weight, then reps).

### 5. Library (`/library`)
Title "Library" + subtitle "ULULUL split · 6 days · Sunday rest". One card per day (radius 22): header = day name (15px/660) + focus/weekday (12px `sub`, e.g. "Chest lean · Mon"); rows 38px = exercise name (13.5px `#D9D9DE`) + prescription right-aligned (12.5px `sub` tabular, e.g. "2 · Max+10 × 5").

### Shared: Tab bar
Floating pill (specs above) with 4 icon-only targets (padding 12px 18px, ≥44px hit area): Home = 2×2 grid of 8px rounded squares; History = 18×17 outlined rounded rect with two 4px dots; Progress = 3 ascending bars; Library = 3 lines. Active = `text` (white), inactive = `idle`. Use simple geometric icons or an icon set matching these shapes (e.g. lucide `layout-grid`, `calendar`, `bar-chart-3`, `list`).

### Shared: Heatmap (3-month dot grid)
3 columns (one per month), each: month label (12px `sub`) + 7×5 grid of 5px circular dots (gap 5px). Dot states: no workout / future = `dot-off`; workout = `dot-on`; standout session ≈ every 9th = `0.95`. Current month uses volt-tinted dots on Home (`rgba(205,244,99,0.55)` / bright `#CDF463`), white elsewhere. Weeks run Mon→Sun; rest Sundays read as gaps.

## Interactions & Behavior

- **Start workout** (hero button or header +): creates a session for today's rotation day, with every set prefilled from the most recent completed instance of that day ("repeat last workout" is the default — carry-over loads). Navigate to `/log`; elapsed timer starts.
- **Tap set circle**: toggles done. On check → start a 90-second rest countdown (replaces any running one). Untoggling does not cancel rest. "Skip" zeroes the countdown. Timer should keep correct time in background (store an end-timestamp, not a tick counter) and ideally fire a notification/vibration at 0.
- **Finish workout**: persists session (sets as performed, duration, computed volume), updates PR records, clears in-progress state, navigates home. Home's ring/day advances.
- **Back from /log**: returns home but keeps the in-progress session (timer continues); reopening resumes. (Prototype simplifies this — implement resume properly.)
- **Card navigation**: body weight / volume / PR cards → `/progress`; consistency card → `/history`.
- **Volume math**: weight × reps summed per session; "Max" stack entries need a user-entered numeric equivalent to count toward volume (or are excluded — owner's call, flag it).
- No hover states (touch-first); use `active:` opacity ~0.7 for tap feedback. All tap targets ≥44px.

## State Management

- **Dexie tables** (suggested):
  - `exercises` (id, name, dayId, order, setCount, targetReps, note)
  - `sessions` (id, dayId, date, startedAt, finishedAt, durationSec, totalVolume)
  - `sets` (id, sessionId, exerciseId, setIndex, weight, reps, completedAt) — weight may be the literal string `"Max"` plus an optional numeric value
  - `bodyWeight` (id, date, lbs)
  - `prs` (exerciseId, weight, reps, date) — or derive from `sets`
- UI state (React): current rest-timer end timestamp, in-progress session id, per-set done map (also persisted so a reload mid-workout resumes).
- `useLiveQuery` drives home stats (last 7-day volume, latest body weight, streak), history, progress, and library "last load" values.
- Zod schemas for all table records; reuse for Supabase sync payloads in phase 2.
- Units: **lbs only**.

## Seed data — the owner's actual split (ULULUL, Mon–Sat)

| Day | Focus | Exercises (sets · carry-over load) |
|---|---|---|
| Upper A | Chest lean | Bench 3 · heavy 3–5 (≈225); Lat pulldown 2 · Max+10×5→Max×6; Cable fly 2 · Max+25×5→Max×6; Chest-supported row 2 · 140×8; Lateral raise 2 · 30×5; SA triceps 2 · 75×6; Incline curl 2 · 13 |
| Lower A | Quad | Leg press 2 · 6pl×6→5+25×6; SLDL 2 · 315×4→295×6; Leg extension 2 · 155×5→150×6; Calf 2 · 10×10; Cable crunch 3 · 10–15 weighted, full stretch |
| Upper B | Back/delt | Paused bench 2 · heavy 4–5; Low row 2 · Max×5; Shoulder press 2 · 80×6→75×6; Pulldown 2 · Max×6; Lateral raise 2 · 30×5; Pressdown 2 · 75×4→70×6; Preacher curl 2 · 42.5×5→40×6 |
| Lower B | Ham | SLDL 2 · 295×6; Leg curl 2 · Max×6; Leg extension 2 · 150×6; Calf 2 · 10×10; Captain's chair leg raise 3 · 8–12, PPT at bottom |
| Upper C | Shoulder lean | Dip 2 · +80×6→+70×6; Lat pulldown 2 · Max×6; Shoulder press 2 · 80×6→75×6; Low row 2 · Max×6; Lateral raise 2 · 30×5; SA triceps 2 · 75×6; Incline curl 2 · 13 |
| Lower C | Quad | Leg press 2 · 6pl×6→5+25×6; Leg curl 2 · Max×6; Adductor 2 · 16×5; Calf 2 · 10×10; Cable crunch 3 · 10–15 weighted |

## Assets

None. No images, no custom fonts (system stack), no SVG illustrations. Icons are simple geometric shapes (specs above) or a permissively-licensed icon set. PWA manifest icon still needed — suggest a volt ring glyph on `#060607`.

## Known gaps (not designed yet — do not invent, ask the owner)

- Editing weight/reps during a session (steppers) — currently sets are tick-only.
- Body-weight quick-log input sheet.
- Empty states / first-run onboarding.
- Settings (rest duration is hard-coded 90s).

## Files

- `Workout App.dc.html` — master design file. Contains the interactive prototype (screens: Home, Log workout, History, Progress, Library) plus three home-screen explorations (V2 chosen). Open in a browser; all styles are inline and exact.
- `ios-frame.jsx` — presentation-only iPhone bezel used by the design file. **Not part of the app.**
