import {
  addDays,
  getISODay,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns'
import { db, uid } from './db'
import { dateKey } from '@/lib/format'
import type { BodyWeight, Day, Exercise, PR, Session } from './types'

/* ── The split: 6 days, Mon–Sat ─────────────────────────────────────────── */
const DAYS: Day[] = [
  { id: 1, name: 'Upper A', focus: 'Chest lean', weekday: 1 },
  { id: 2, name: 'Lower A', focus: 'Quad', weekday: 2 },
  { id: 3, name: 'Upper B', focus: 'Back + delt', weekday: 3 },
  { id: 4, name: 'Lower B', focus: 'Ham', weekday: 4 },
  { id: 5, name: 'Upper C', focus: 'Shoulder lean', weekday: 5 },
  { id: 6, name: 'Lower C', focus: 'Quad', weekday: 6 },
]

/** [name, sets, weight, reps, note, libLoad] */
type Row = [string, number, string, string, string, string]

const CATALOG: Record<number, Row[]> = {
  1: [
    ['Bench — main strength', 3, '225 lb', '× 4', 'heavy 3–5', 'heavy 3–5 · 225'],
    ['Lat pulldown', 2, 'Max+10', '× 5', 'Max+10 × 5 → Max × 6', 'Max+10 × 5'],
    ['Cable fly', 2, 'Max+25', '× 5', 'Max+25 × 5 → Max × 6', 'Max+25 × 5'],
    ['Chest-supported row', 2, '140 lb', '× 8', '140 × 8', '140 × 8'],
    ['Lateral raise', 2, '30 lb', '× 5', 'Strict', '30 × 5'],
    ['SA triceps', 2, '75 lb', '× 6', 'Single arm', '75 × 6'],
    ['Incline curl', 2, '13 lb', '× 8', 'Full stretch', '13'],
  ],
  2: [
    ['Leg press', 2, '6 pl', '× 6', '6 pl × 6 → 5+25 × 6', '6 pl × 6'],
    ['SLDL', 2, '315 lb', '× 4', '315 × 4 → 295 × 6', '315 × 4'],
    ['Leg extension', 2, '155 lb', '× 5', '155 × 5 → 150 × 6', '155 × 5'],
    ['Calf', 2, '10', '× 10', 'Full stretch', '10 × 10'],
    ['Cable crunch', 3, 'wtd', '× 12', 'Full stretch', '10–15 wtd'],
  ],
  3: [
    ['Paused bench', 2, 'heavy', '× 4', 'Paused', 'heavy 4–5'],
    ['Low row', 2, 'Max', '× 5', 'Max × 5', 'Max × 5'],
    ['Shoulder press', 2, '80 lb', '× 6', '80 × 6 → 75 × 6', '80 × 6'],
    ['Pulldown', 2, 'Max', '× 6', 'Max × 6', 'Max × 6'],
    ['Lateral raise', 2, '30 lb', '× 5', 'Strict', '30 × 5'],
    ['Pressdown', 2, '75 lb', '× 4', '75 × 4 → 70 × 6', '75 × 4'],
    ['Preacher curl', 2, '42.5 lb', '× 5', '42.5 × 5 → 40 × 6', '42.5 × 5'],
  ],
  4: [
    ['SLDL', 2, '295 lb', '× 6', '295 × 6', '295 × 6'],
    ['Leg curl', 2, 'Max', '× 6', 'Max × 6', 'Max × 6'],
    ['Leg extension', 2, '150 lb', '× 6', '150 × 6', '150 × 6'],
    ['Calf', 2, '10', '× 10', 'Full stretch', '10 × 10'],
    ["Captain's chair leg raise", 3, 'BW', '× 10', 'PPT at bottom', '8–12 PPT'],
  ],
  5: [
    ['Dip', 2, '+70 lb', '× 6', '+80 × 6 → +70 × 6', '+70 × 6'],
    ['Lat pulldown', 2, 'Max', '× 6', 'Max × 6', 'Max × 6'],
    ['Shoulder press', 2, '75 lb', '× 6', '80 × 6 → 75 × 6', '75 × 6'],
    ['Low row', 2, 'Max', '× 6', 'Max × 6', 'Max × 6'],
    ['Lateral raise', 2, '30 lb', '× 5', 'Strict', '30 × 5'],
    ['SA triceps', 2, '75 lb', '× 6', 'Single arm', '75 × 6'],
    ['Incline curl', 2, '13 lb', '× 8', 'Full stretch', '13'],
  ],
  6: [
    ['Leg press', 2, '6 pl', '× 6', '6 pl × 6 → 5+25 × 6', '6 pl × 6'],
    ['Leg curl', 2, 'Max', '× 6', 'Max × 6', 'Max × 6'],
    ['Adductor', 2, '16', '× 5', '16 × 5', '16 × 5'],
    ['Calf', 2, '10', '× 10', 'Full stretch', '10 × 10'],
    ['Cable crunch', 3, 'wtd', '× 12', 'Full stretch', '10–15 wtd'],
  ],
}

function buildExercises(now: number): Exercise[] {
  const out: Exercise[] = []
  for (const day of DAYS) {
    CATALOG[day.id].forEach((r, i) => {
      const [name, sets, weight, reps, note, libLoad] = r
      out.push({
        id: uid(),
        dayId: day.id,
        order: i + 1,
        name,
        sets,
        weight,
        reps,
        note,
        libLoad,
        updatedAt: now,
      })
    })
  }
  return out
}

/* ── Deterministic pseudo-random so the demo looks the same each first run ── */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/**
 * Demo history so History/Progress aren't empty on first launch:
 * sessions Mon–Sat for the past ~11 weeks (this week's past days always present;
 * older weeks occasionally miss one), a 12-week body-weight trend, and a few PRs.
 * Anchored to `now`, so it stays fresh whenever the app is first opened.
 */
function buildHistory(now: Date) {
  const rand = rng(20260612)
  const sessions: Session[] = []
  const weekMonday = startOfWeek(now, { weekStartsOn: 1 })

  // 11 weeks back up to *yesterday* — today stays unlogged so it's the pending hero
  const start = subWeeks(weekMonday, 11)
  const todayMidnight = startOfDay(now)
  for (let d = new Date(start); d < todayMidnight; d = addDays(d, 1)) {
    const wd = getISODay(d) // 1..7
    if (wd === 7) continue // Sunday rest
    const thisWeek = d >= weekMonday
    // older weeks: ~12% chance of a missed session; current week: never miss
    if (!thisWeek && rand() < 0.12) continue
    const vol = Math.round(7000 + rand() * 6000)
    const dur = Math.round(46 + rand() * 14) * 60
    const startedAt = d.getTime() + 18 * 3600 * 1000
    sessions.push({
      id: uid(),
      dayId: wd, // weekday == rotation order
      date: dateKey(d),
      startedAt,
      finishedAt: startedAt + dur * 1000,
      durationSec: dur,
      totalVolume: vol,
      updatedAt: startedAt,
    })
  }

  // Body weight: 12 weekly points trending 190.8 → 186.4 (a slow cut), plus today.
  const bodyWeight: BodyWeight[] = []
  for (let w = 11; w >= 0; w--) {
    const day = subWeeks(now, w)
    const base = 190.8 - (190.8 - 186.4) * ((11 - w) / 11)
    const lbs = w === 0 ? 186.4 : Math.round((base + (rand() - 0.5) * 0.8) * 10) / 10
    bodyWeight.push({ id: uid(), date: dateKey(day), lbs, updatedAt: day.getTime() })
  }

  const prs: PR[] = [
    { name: 'Bench', load: '230 × 3', day: 4 },
    { name: 'Leg press', load: '6 pl +25 × 6', day: 3 },
    { name: 'Dip', load: '+75 × 6', day: 7 },
    { name: 'SLDL', load: '315 × 4', day: 8 },
  ].map((p) => ({
    id: uid(),
    exerciseId: null,
    name: p.name,
    load: p.load,
    date: dateKey(subDays(now, p.day)),
    updatedAt: now.getTime(),
  }))

  return { sessions, bodyWeight, prs }
}

/**
 * Seed on first launch only (when the DB is empty). Idempotent: if `days`
 * already has rows it does nothing, so reopening the app never duplicates data.
 */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.days.count()
  if (count > 0) return

  const now = new Date()
  const exercises = buildExercises(now.getTime())
  const { sessions, bodyWeight, prs } = buildHistory(now)

  await db.transaction(
    'rw',
    [db.days, db.exercises, db.sessions, db.bodyWeight, db.prs],
    async () => {
      await db.days.bulkAdd(DAYS)
      await db.exercises.bulkAdd(exercises)
      await db.sessions.bulkAdd(sessions)
      await db.bodyWeight.bulkAdd(bodyWeight)
      await db.prs.bulkAdd(prs)
    },
  )
}

/** Wipe everything and reseed — handy while iterating, exposed via Settings later. */
export async function resetAndReseed(): Promise<void> {
  await db.delete()
  await db.open()
  await seedIfEmpty()
}
