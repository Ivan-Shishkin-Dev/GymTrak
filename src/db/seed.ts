import { db, uid } from './db'
import { canonicalLoad } from '@/lib/load'
import type { Day, Exercise, LoadType, SetRow } from './types'

/* ── The split: 6 days (Upper A → Lower C) ──────────────────────────────── */
const DAYS: Day[] = [
  { id: 1, name: 'Upper A', focus: 'Chest lean' },
  { id: 2, name: 'Lower A', focus: 'Quad' },
  { id: 3, name: 'Upper B', focus: 'Back + delt' },
  { id: 4, name: 'Lower B', focus: 'Ham' },
  { id: 5, name: 'Upper C', focus: 'Shoulder lean' },
  { id: 6, name: 'Lower C', focus: 'Quad' },
]

/** One planned set: [rawLoad, reps]. Load is canonicalized through the grammar at build. */
type SetSpec = [string, string]
/** A catalog entry: display name, load type, its per-set loads, optional cue. */
type Row = { name: string; type: LoadType; sets: SetSpec[]; note?: string }

/*
 * The real split. Per-set loads are stored individually (back-offs preserved).
 * `machine` loads carry their unit in the string: bare "12" is a level, "120 lb"
 * is a pounds stack. Same-named exercises across days are LINKED (see
 * propagateLoad in actions.ts) — the names below are deliberately unified so the
 * link matches (e.g. "Lat Pulldown", "Calf", "Shoulder Press", "Single-Arm Tricep").
 */
const CATALOG: Record<number, Row[]> = {
  1: [
    { name: 'Heavy Bench', type: 'weight', sets: [['225 lb', '× 2'], ['225 lb', '× 2'], ['205 lb', '× 2']] },
    { name: 'Lat Pulldown', type: 'machine', sets: [['Max + 10', '× 6'], ['Max', '× 6']] },
    { name: 'Single-Arm Tricep', type: 'weight', sets: [['85 lb', '× 5'], ['75 lb', '× 6']] },
    { name: 'Lateral Raise', type: 'machine', sets: [['50 lb', '× 5'], ['45 lb', '× 6']] },
    { name: 'Pec Dec', type: 'machine', sets: [['Max + 35', '× 5'], ['Max + 10', '× 6']] },
    { name: 'Incline Curl', type: 'machine', sets: [['12', '× 6'], ['11', '× 6']] },
    { name: 'Chest-Supported Row', type: 'machine', sets: [['Max', '× 6'], ['140 lb', '× 6']] },
  ],
  2: [
    { name: 'Leg Press', type: 'plates', sets: [['6 pl + 10', '× 6'], ['5 pl + 25', '× 6']] },
    { name: 'SLDL', type: 'weight', sets: [['315 lb', '× 4'], ['295 lb', '× 6']] },
    { name: 'Leg Extension', type: 'weight', sets: [['150 lb', '× 6'], ['140 lb', '× 6']] },
    { name: 'Calf', type: 'machine', sets: [['10', '× 10'], ['10', '× 10']] },
    { name: 'Cable Crunch', type: 'machine', sets: [['Max', '× 10'], ['Max', '× 10']] },
  ],
  3: [
    { name: 'Paused Bench (2nd exposure)', type: 'weight', sets: [['205 lb', '× 3'], ['205 lb', '× 3']] },
    { name: 'Shoulder Press', type: 'machine', sets: [['120 lb', '× 5'], ['110 lb', '× 6']] },
    { name: 'Pressdown', type: 'weight', sets: [['80 lb', '× 6'], ['75 lb', '× 6']] },
    { name: 'Low Row', type: 'machine', sets: [['Max', '× 5'], ['Max', '× 5']] },
    { name: 'Lat Pulldown', type: 'machine', sets: [['Max', '× 6'], ['Max', '× 6']] },
    { name: 'Lateral Raise', type: 'machine', sets: [['50 lb', '× 5'], ['45 lb', '× 6']] },
    { name: 'Preacher Curl', type: 'weight', sets: [['40 lb', '× 6'], ['40 lb', '× 6']] },
  ],
  4: [
    { name: 'SLDL', type: 'weight', sets: [['315 lb', '× 6'], ['315 lb', '× 6']] },
    { name: 'Leg Curl', type: 'machine', sets: [['Max', '× 6'], ['Max', '× 6']] },
    { name: 'Leg Extension', type: 'weight', sets: [['150 lb', '× 6'], ['150 lb', '× 6']] },
    { name: 'Calf', type: 'machine', sets: [['10', '× 10'], ['10', '× 10']] },
    { name: "Captain's Chair Leg Raise", type: 'bodyweight', sets: [['BW', '× 8–12'], ['BW', '× 8–12'], ['BW', '× 8–12']], note: 'PPT at bottom' },
  ],
  5: [
    { name: 'Dip', type: 'bodyweight', sets: [['+80', '× 6'], ['+80', '× 5']] },
    { name: 'Lat Pulldown', type: 'machine', sets: [['Max + 10', '× 5'], ['Max', '× 6']] },
    { name: 'Shoulder Press', type: 'machine', sets: [['125 lb', '× 5'], ['120 lb', '× 6']] },
    { name: 'Single-Arm Tricep', type: 'weight', sets: [['85 lb', '× 4'], ['77.5 lb', '× 6']] },
    { name: 'Lateral Raise', type: 'machine', sets: [['50 lb', '× 5'], ['45 lb', '× 6']] },
    { name: 'Incline Curl', type: 'machine', sets: [['10', '× 6'], ['10', '× 6']] },
    { name: 'Mid Back', type: 'machine', sets: [['Max', '× 6'], ['Max', '× 6']] },
  ],
  6: [
    { name: 'Leg Press', type: 'plates', sets: [['6 pl + 10', '× 6'], ['5 pl + 35', '× 6']] },
    { name: 'Leg Curl', type: 'machine', sets: [['155 lb', '× 6'], ['145 lb', '× 6']] },
    { name: 'Adductor', type: 'machine', sets: [['16', '× 5'], ['16', '× 5']] },
    { name: 'Calf', type: 'machine', sets: [['10', '× 10'], ['10', '× 10']] },
    { name: 'Cable Crunch', type: 'machine', sets: [['90 lb', '× 6'], ['80 lb', '× 6'], ['80 lb', '× 6']] },
  ],
}

function buildExercises(now: number): Exercise[] {
  const out: Exercise[] = []
  for (const day of DAYS) {
    CATALOG[day.id].forEach((r, i) => {
      // normalize each set through the grammar so a fresh seed is already canonical
      const rows: SetRow[] = r.sets.map(([w, reps]) => ({
        weight: canonicalLoad(w, r.type),
        reps,
      }))
      out.push({
        id: uid(),
        dayId: day.id,
        order: i + 1,
        name: r.name,
        sets: rows.length,
        weight: rows[0].weight, // first-set fallback when setRows is absent
        reps: rows[0].reps,
        note: r.note ?? '',
        libLoad: '',
        setRows: rows,
        loadType: r.type,
        updatedAt: now,
      })
    })
  }
  return out
}

/**
 * Seed on first launch only (when the DB is empty). Idempotent: if `days`
 * already has rows it does nothing, so reopening the app never duplicates data.
 * Seeds the split only — rotation starts at Day 1.
 */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.days.count()
  if (count > 0) return

  const exercises = buildExercises(Date.now())

  await db.transaction('rw', [db.days, db.exercises], async () => {
    await db.days.bulkAdd(DAYS)
    await db.exercises.bulkAdd(exercises)
  })
}

/** Wipe everything and reseed — handy while iterating, exposed via Settings later. */
export async function resetAndReseed(): Promise<void> {
  await db.delete()
  await db.open()
  await seedIfEmpty()
}
