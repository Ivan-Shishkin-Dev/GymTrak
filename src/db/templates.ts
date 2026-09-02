import { addDays, isMonday, nextMonday, parseISO } from 'date-fns'
import { uid } from './db'
import { dateKey } from '@/lib/format'
import type {
  Dow,
  Exercise,
  LoadType,
  ProgramSlot,
  ProgramWeek,
  RunPrescription,
  SetRow,
} from './types'

/**
 * The split and its program, as pure data: the four consolidated lift days and
 * the eight Base Phase weeks (9–16) that schedule them.
 *
 * Two consumers, both in this folder: `seed.ts` builds a fresh database from
 * these on first launch, and `program.ts` installs them into a database that
 * already has data. Neither depends on the other, so this file holds nothing
 * but templates and the helpers that turn them into rows.
 */

export type TemplateSlug = 'upper-a' | 'lower-a' | 'upper-b' | 'lower-b'

type ExerciseSpec = { name: string; loadType: LoadType; setRows: SetRow[] }
export type TemplateSpec = {
  slug: TemplateSlug
  name: string
  focus: string
  exercises: ExerciseSpec[]
}

/*
 * The four consolidated lift templates.
 *
 * These are written as literal SetRow[] and are NOT passed through
 * `canonicalLoad`. One SetRow is exactly one set: the plan's `·` separator is the
 * ARRAY and a leading `N x` is the SET COUNT, and neither survives the grammar —
 * canonicalLoad('2 x 4pl', 'plates') is '2 pl' and canonicalLoad('2 x 16',
 * 'machine') is '2'. The strings below are already canonical `formatLoad` output.
 *
 * Machine loads carry their unit: a bare "12" is a stack level, "220 lb" is
 * pounds. The rule matching the rest of the library is >20 ⇒ pounds.
 */
export const BASE_TEMPLATES: TemplateSpec[] = [
  {
    slug: 'upper-a',
    name: 'Upper A',
    focus: 'Press lean',
    exercises: [
      { name: 'Incline Press', loadType: 'plates', setRows: [{ weight: '2 pl + 10', reps: '× 7' }, { weight: '2 pl', reps: '× 9' }] },
      { name: 'Dip', loadType: 'bodyweight', setRows: [{ weight: '+90', reps: '× 6' }, { weight: '+85', reps: '× 5' }] },
      { name: 'Pec Dec', loadType: 'machine', setRows: [{ weight: '220 lb', reps: '× 6' }, { weight: '210 lb', reps: '× 6' }] },
      { name: 'Shoulder Press', loadType: 'machine', setRows: [{ weight: '130 lb', reps: '× 6' }, { weight: '120 lb', reps: '× 6' }] },
      { name: 'Lateral Raise', loadType: 'machine', setRows: [{ weight: '50 lb', reps: '× 6' }, { weight: '45 lb', reps: '× 6' }] },
      { name: 'Single-Arm Tricep', loadType: 'weight', setRows: [{ weight: '85 lb', reps: '× 6' }, { weight: '75 lb', reps: '× 9' }] },
      { name: 'Incline Curl', loadType: 'machine', setRows: [{ weight: '12', reps: '× 6' }, { weight: '11', reps: '× 6' }] },
    ],
  },
  {
    slug: 'lower-a',
    name: 'Lower A',
    focus: 'Quad',
    exercises: [
      { name: 'Leg Press', loadType: 'plates', setRows: [{ weight: '5 pl', reps: '× 7' }, { weight: '4 pl + 25', reps: '× 6' }] },
      { name: 'Leg Extension', loadType: 'weight', setRows: [{ weight: '250 lb', reps: '× 5' }, { weight: '230 lb', reps: '× 5' }] },
      { name: 'Adductor', loadType: 'machine', setRows: [{ weight: '16', reps: '× 5' }, { weight: '16', reps: '× 5' }] },
      { name: 'Calf', loadType: 'machine', setRows: [{ weight: '12', reps: '× 8' }, { weight: '12', reps: '× 6' }] },
      { name: 'Tibialis Raise', loadType: 'bodyweight', setRows: [{ weight: 'BW', reps: '× 20' }, { weight: 'BW', reps: '× 20' }] },
      { name: 'Hip Abduction', loadType: 'machine', setRows: [{ weight: '15', reps: '' }, { weight: '15', reps: '' }] },
      { name: 'Cable Crunch', loadType: 'machine', setRows: [{ weight: '14', reps: '× 8' }, { weight: '13', reps: '× 8' }] },
    ],
  },
  {
    slug: 'upper-b',
    name: 'Upper B',
    focus: 'Pull lean',
    exercises: [
      { name: 'T-Bar', loadType: 'plates', setRows: [{ weight: '4 pl', reps: '× 6' }, { weight: '4 pl', reps: '× 6' }] },
      { name: 'SA Lat Pulldown', loadType: 'machine', setRows: [{ weight: '110 lb', reps: '× 6' }, { weight: '100 lb', reps: '× 4' }] },
      { name: 'Lat Pulldown Mach', loadType: 'machine', setRows: [{ weight: '220 lb', reps: '× 6' }, { weight: '205 lb', reps: '× 6' }] },
      { name: 'Chest Fly', loadType: 'machine', setRows: [{ weight: '200 lb', reps: '× 5' }, { weight: '190 lb', reps: '× 5' }] },
      { name: 'Lateral Raise', loadType: 'machine', setRows: [{ weight: '50 lb', reps: '× 6' }, { weight: '45 lb', reps: '× 6' }] },
      { name: 'Pressdown', loadType: 'weight', setRows: [{ weight: '90 lb', reps: '× 4' }, { weight: '75 lb', reps: '× 6' }] },
      { name: 'Preacher Curl', loadType: 'weight', setRows: [{ weight: '40 lb', reps: '× 6' }, { weight: '37.5 lb', reps: '× 6' }] },
    ],
  },
  {
    slug: 'lower-b',
    name: 'Lower B',
    focus: 'Posterior',
    exercises: [
      { name: 'SLDL', loadType: 'weight', setRows: [{ weight: '335 lb', reps: '× 5' }, { weight: '315 lb', reps: '× 4' }] },
      { name: 'Leg Curl', loadType: 'machine', setRows: [{ weight: '170 lb', reps: '× 10' }, { weight: '130 lb', reps: '× 6' }] },
      { name: 'Leg Extension', loadType: 'weight', setRows: [{ weight: '155 lb', reps: '× 5' }, { weight: '145 lb', reps: '× 5' }] },
      { name: 'Calf', loadType: 'machine', setRows: [{ weight: '12', reps: '× 8' }, { weight: '12', reps: '× 6' }] },
      { name: 'Tibialis Raise', loadType: 'bodyweight', setRows: [{ weight: 'BW', reps: '× 20' }, { weight: 'BW', reps: '× 20' }] },
      { name: 'Hip Abduction', loadType: 'machine', setRows: [{ weight: '15', reps: '' }, { weight: '15', reps: '' }] },
      { name: 'Crunch Machine', loadType: 'machine', setRows: [{ weight: '14', reps: '× 8' }, { weight: '13', reps: '× 8' }] },
    ],
  },
]

/** A template's exercises as rows for the day with id `dayId`. */
export function templateExercises(
  t: TemplateSpec,
  dayId: number,
  now: number,
): Exercise[] {
  return t.exercises.map((e, i) => ({
    id: uid(),
    dayId,
    order: i + 1,
    name: e.name,
    sets: e.setRows.length,
    weight: e.setRows[0].weight, // first-set fallback when setRows is absent
    reps: e.setRows[0].reps,
    setRows: e.setRows,
    loadType: e.loadType,
    updatedAt: now,
  }))
}

/* ── Weeks 9–16 ───────────────────────────────────────────────────────────── */

export const BASE_FIRST_WEEK = 9
export const BASE_LAST_WEEK = 16

/** Run minutes per week, in [mon, wed, thu, sat] order. */
const RUN_MIN: Record<number, [number, number, number, number]> = {
  9: [25, 30, 25, 45],
  10: [25, 30, 25, 50],
  11: [30, 35, 25, 55],
  12: [20, 25, 20, 40], // deload
  13: [30, 35, 25, 60],
  14: [30, 35, 30, 65],
  15: [30, 40, 30, 70],
  16: [25, 30, 20, 50], // deload
}

const DELOAD_WEEKS = new Set([12, 16])

/** Zone 2 for every run in this phase. */
const HR = { hrZoneMin: 120, hrZoneMax: 140, hrHardCap: 145 }

/** Strides on Wed and Sat, weeks 13–16 only. */
const hasStrides = (week: number, dow: Dow): boolean =>
  week >= 13 && (dow === 'wed' || dow === 'sat')

const run = (
  week: number,
  dow: Dow,
  label: RunPrescription['label'],
  timing: RunPrescription['timing'],
  durationMin: number,
): RunPrescription => ({
  label,
  timing,
  durationMin,
  ...HR,
  strides: hasStrides(week, dow),
  notes: null, // the strides copy is derived from `strides`, not duplicated per week
})

/**
 * The eight Base Phase weeks, anchored to `startMonday` (the Monday of week 9).
 * Every week has the same shape; only the run durations change.
 */
export function baseWeeks(
  startMonday: string,
  ids: Record<TemplateSlug, number>,
  now: number,
): ProgramWeek[] {
  const weeks: ProgramWeek[] = []
  for (let n = BASE_FIRST_WEEK; n <= BASE_LAST_WEEK; n++) {
    const [mon, wed, thu, sat] = RUN_MIN[n]
    const slots: ProgramSlot[] = [
      { dow: 'mon', liftDayId: ids['upper-a'], run: run(n, 'mon', 'Easy Run', 'after-lift', mon) },
      { dow: 'tue', liftDayId: ids['lower-a'], run: null },
      { dow: 'wed', liftDayId: null, run: run(n, 'wed', 'Easy Run', 'standalone', wed) },
      { dow: 'thu', liftDayId: ids['upper-b'], run: run(n, 'thu', 'Easy Run', 'after-lift', thu) },
      { dow: 'fri', liftDayId: ids['lower-b'], run: null },
      { dow: 'sat', liftDayId: null, run: run(n, 'sat', 'Long Run', 'standalone', sat) },
      { dow: 'sun', liftDayId: null, run: null }, // rest
    ]
    weeks.push({
      id: n,
      phase: n <= 12 ? 'base-1' : 'base-2',
      startDate: dateKey(addDays(parseISO(startMonday), (n - BASE_FIRST_WEEK) * 7)),
      isDeload: DELOAD_WEEKS.has(n),
      slots,
      updatedAt: now,
    })
  }
  return weeks
}

/**
 * The Monday to start on. `nextMonday` is strictly future, so on a Monday it
 * would skip a whole week — if you're installing the program that morning, that
 * Monday is the one you mean.
 */
export function upcomingMonday(now: Date): Date {
  return isMonday(now) ? now : nextMonday(now)
}
