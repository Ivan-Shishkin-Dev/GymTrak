import { addDays, getISODay, startOfDay, startOfWeek, subWeeks } from 'date-fns'
import { db, uid } from './db'
import { dateKey, parseLoad, parseReps } from '@/lib/format'
import type { Day, Exercise, Note, PR, Session, WorkoutSet } from './types'

/* ── The split: 6 days (Upper A → Lower C) ──────────────────────────────── */
const DAYS: Day[] = [
  { id: 1, name: 'Upper A', focus: 'Chest lean' },
  { id: 2, name: 'Lower A', focus: 'Quad' },
  { id: 3, name: 'Upper B', focus: 'Back + delt' },
  { id: 4, name: 'Lower B', focus: 'Ham' },
  { id: 5, name: 'Upper C', focus: 'Shoulder lean' },
  { id: 6, name: 'Lower C', focus: 'Quad' },
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

/* Realistic post-set notes, sprinkled onto a fraction of historical sets so the
 * History detail view ("what I hit + my comments") has something to show. */
const COMMENTS = [
  'Felt strong — add weight next time',
  'Last rep was a grind',
  'Left elbow a little cranky',
  'Easy, bump it up',
  'Good depth, controlled',
  'Grip gave out before the muscle did',
  'Clean reps, video looked solid',
  'Lower back tight — kept it conservative',
  'Tempo on point today',
  'Cut it one short, shoulder pinch',
]

/**
 * Demo history so History isn't empty on first launch: finished sessions for the
 * past ~11 weeks (this week's past days always present; older weeks occasionally
 * miss one), each with its completed sets — some carrying a post-set comment.
 * The day rotation is a pure 1→6 cycle. Anchored to `now` so it stays fresh.
 */
function buildHistory(now: Date) {
  const rand = rng(20260612)
  const sessions: Session[] = []
  const sets: WorkoutSet[] = []
  const weekMonday = startOfWeek(now, { weekStartsOn: 1 })

  // 11 weeks back up to *yesterday* — today stays unlogged so it's the pending hero
  const start = subWeeks(weekMonday, 11)
  const todayMidnight = startOfDay(now)
  let cyc = 0
  for (let d = new Date(start); d < todayMidnight; d = addDays(d, 1)) {
    const wd = getISODay(d) // 1..7
    if (wd === 7) continue // demo cadence: no session on the 7th day
    const thisWeek = d >= weekMonday
    // older weeks: ~12% chance of a missed session; current week: never miss
    if (!thisWeek && rand() < 0.12) continue
    const dur = Math.round(46 + rand() * 14) * 60
    const startedAt = d.getTime() + 18 * 3600 * 1000
    const sessionId = uid()
    const dayId = (cyc % 6) + 1 // pure 1→6 rotation cycle
    sessions.push({
      id: sessionId,
      dayId,
      date: dateKey(d),
      startedAt,
      finishedAt: startedAt + dur * 1000,
      durationSec: dur,
      updatedAt: startedAt,
    })

    // completed sets for this session, straight from the day's catalog
    let offset = 60
    for (const [name, setCount, weight, reps] of CATALOG[dayId]) {
      for (let i = 0; i < setCount; i++) {
        offset += 150 + Math.round(rand() * 120)
        const hasComment = rand() < 0.16
        sets.push({
          id: uid(),
          sessionId,
          exerciseId: uid(), // synthetic — history groups by exerciseName
          exerciseName: name,
          setIndex: i,
          weight,
          reps,
          weightNum: parseLoad(weight),
          repsNum: parseReps(reps),
          completedAt: startedAt + offset * 1000,
          comment: hasComment
            ? COMMENTS[Math.floor(rand() * COMMENTS.length)]
            : undefined,
          updatedAt: startedAt,
        })
      }
    }
    cyc++
  }

  return { sessions, sets }
}

/** A few starter notes for the Home notepad. */
function buildNotes(now: Date): Note[] {
  const base = now.getTime()
  const day = 86_400_000
  const mk = (text: string, daysAgo: number): Note => {
    const t = base - daysAgo * day
    return { id: uid(), text, createdAt: t, updatedAt: t }
  }
  return [
    mk('Deload paid off — top sets moved faster all week.', 3),
    mk('Switching incline curls to a slight decline; the stretch feels better.', 8),
    mk('Sleep has been rough — keep sessions to ~45 min on the bad days.', 15),
  ]
}

/** A handful of logged PRs, each stamped with the moment it was hit. */
function buildPRs(now: Date): PR[] {
  const base = now.getTime()
  const day = 86_400_000
  const mk = (lift: string, value: string, daysAgo: number, hour: number): PR => {
    const d = new Date(base - daysAgo * day)
    d.setHours(hour, 14, 0, 0)
    const at = d.getTime()
    return { id: uid(), lift, value, at, date: dateKey(d), updatedAt: at }
  }
  return [
    mk('Shoulder press', '85 × 5', 3, 17),
    mk('Dip', '+90 × 5', 9, 18),
    mk('SLDL', '315 × 6', 16, 19),
    mk('Bench', '225 × 4', 34, 18),
  ]
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
  const { sessions, sets } = buildHistory(now)
  const notes = buildNotes(now)
  const prs = buildPRs(now)

  await db.transaction(
    'rw',
    [db.days, db.exercises, db.sessions, db.sets, db.notes, db.prs],
    async () => {
      await db.days.bulkAdd(DAYS)
      await db.exercises.bulkAdd(exercises)
      await db.sessions.bulkAdd(sessions)
      await db.sets.bulkAdd(sets)
      await db.notes.bulkAdd(notes)
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
