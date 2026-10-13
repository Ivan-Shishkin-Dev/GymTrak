import { addDays, isMonday, nextMonday, parseISO } from 'date-fns'
import { uid } from './db'
import { dateKey } from '@/lib/format'
import type {
  Exercise,
  LoadType,
  ProgramSlot,
  ProgramWeek,
  RunPrescription,
  SetRow,
} from './types'

/**
 * The split and its program, as pure data: the four consolidated lift days and
 * the eight run-block weeks (1–8) that schedule them.
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

/**
 * Bumped whenever the templates or the weeks below change shape. A saved day
 * whose `planRevision` is behind this gets the current plan applied once.
 *
 * It is a separate field from `splitRevision`, which stays at 1 for good: app
 * versions from before this one re-apply their own templates to any day whose
 * `splitRevision` is not exactly 1, so moving that number would have an old
 * install on another device undo the plan every time it synced.
 */
export const PLAN_REVISION = 3
export const SPLIT_REVISION = 1

/*
 * The four consolidated lift templates. Shoulder press and arms open both
 * lower days, ahead of the leg work.
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
    focus: 'Push / pull',
    exercises: [
      { name: 'Machine Press', loadType: 'machine', setRows: [{ weight: '', reps: '' }, { weight: '', reps: '' }] },
      { name: 'T-Bar', loadType: 'plates', setRows: [{ weight: '4 pl', reps: '× 6' }, { weight: '4 pl', reps: '× 6' }] },
      { name: 'Pec Dec', loadType: 'machine', setRows: [{ weight: '220 lb', reps: '× 6' }, { weight: '210 lb', reps: '× 6' }] },
      { name: 'Lat Pulldown Mach', loadType: 'machine', setRows: [{ weight: '220 lb', reps: '× 6' }, { weight: '205 lb', reps: '× 6' }] },
      { name: 'Lateral Raise', loadType: 'machine', setRows: [{ weight: '50 lb', reps: '× 6' }, { weight: '45 lb', reps: '× 6' }] },
    ],
  },
  {
    slug: 'lower-a',
    name: 'Lower A',
    focus: 'Shoulders, arms / quad',
    exercises: [
      { name: 'Shoulder Press', loadType: 'machine', setRows: [{ weight: '130 lb', reps: '× 6' }, { weight: '120 lb', reps: '× 6' }] },
      { name: 'Incline Curl', loadType: 'machine', setRows: [{ weight: '12', reps: '× 6' }, { weight: '11', reps: '× 6' }] },
      { name: 'Single-Arm Tricep', loadType: 'weight', setRows: [{ weight: '85 lb', reps: '× 6' }, { weight: '75 lb', reps: '× 9' }] },
      { name: 'Leg Press', loadType: 'plates', setRows: [{ weight: '5 pl', reps: '× 7' }, { weight: '4 pl + 25', reps: '× 6' }] },
      { name: 'Leg Curl', loadType: 'machine', setRows: [{ weight: '170 lb', reps: '× 10' }, { weight: '130 lb', reps: '× 6' }] },
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
    focus: 'Push / pull',
    exercises: [
      { name: 'Machine Press', loadType: 'machine', setRows: [{ weight: '', reps: '' }, { weight: '', reps: '' }] },
      { name: 'T-Bar', loadType: 'plates', setRows: [{ weight: '4 pl', reps: '× 6' }, { weight: '4 pl', reps: '× 6' }] },
      { name: 'Pec Dec', loadType: 'machine', setRows: [{ weight: '220 lb', reps: '× 6' }, { weight: '210 lb', reps: '× 6' }] },
      { name: 'Lat Pulldown Mach', loadType: 'machine', setRows: [{ weight: '220 lb', reps: '× 6' }, { weight: '205 lb', reps: '× 6' }] },
      { name: 'Lateral Raise', loadType: 'machine', setRows: [{ weight: '50 lb', reps: '× 6' }, { weight: '45 lb', reps: '× 6' }] },
    ],
  },
  {
    slug: 'lower-b',
    name: 'Lower B',
    focus: 'Shoulders, arms / hamstring',
    exercises: [
      { name: 'Shoulder Press', loadType: 'machine', setRows: [{ weight: '130 lb', reps: '× 6' }, { weight: '120 lb', reps: '× 6' }] },
      { name: 'Incline Curl', loadType: 'machine', setRows: [{ weight: '12', reps: '× 6' }, { weight: '11', reps: '× 6' }] },
      { name: 'Single-Arm Tricep', loadType: 'weight', setRows: [{ weight: '85 lb', reps: '× 6' }, { weight: '75 lb', reps: '× 9' }] },
      { name: 'SLDL', loadType: 'weight', setRows: [{ weight: '335 lb', reps: '× 5' }, { weight: '315 lb', reps: '× 4' }] },
      { name: 'Leg Curl', loadType: 'machine', setRows: [{ weight: '170 lb', reps: '× 10' }, { weight: '130 lb', reps: '× 6' }] },
      { name: 'Leg Extension', loadType: 'weight', setRows: [{ weight: '250 lb', reps: '× 5' }, { weight: '230 lb', reps: '× 5' }] },
      { name: 'Adductor', loadType: 'machine', setRows: [{ weight: '16', reps: '× 5' }, { weight: '16', reps: '× 5' }] },
      { name: 'Calf', loadType: 'machine', setRows: [{ weight: '12', reps: '× 8' }, { weight: '12', reps: '× 6' }] },
      { name: 'Tibialis Raise', loadType: 'bodyweight', setRows: [{ weight: 'BW', reps: '× 20' }, { weight: 'BW', reps: '× 20' }] },
      { name: 'Hip Abduction', loadType: 'machine', setRows: [{ weight: '15', reps: '' }, { weight: '15', reps: '' }] },
      { name: 'Cable Crunch', loadType: 'machine', setRows: [{ weight: '14', reps: '× 8' }, { weight: '13', reps: '× 8' }] },
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

/* ── Weeks 1–8 ────────────────────────────────────────────────────────────── */

export const BASE_FIRST_WEEK = 1
export const BASE_LAST_WEEK = 8

/** Zone 2 for easy and long runs. */
const EASY_HR = { hrZoneMin: 120, hrZoneMax: 140, hrHardCap: 145 }
/** Session average for intervals and tempo, warm-up and recoveries included. */
const QUALITY_HR = { hrZoneMin: 145, hrZoneMax: 175, hrHardCap: 185 }
const RACE_HR = { hrZoneMin: 165, hrZoneMax: 190, hrHardCap: 200 }

const HR: Record<RunPrescription['label'], typeof EASY_HR> = {
  'Easy Run': EASY_HR,
  'Long Run': EASY_HR,
  Intervals: QUALITY_HR,
  'Tempo Run': QUALITY_HR,
  'Time Trial': RACE_HR,
}

/*
 * Paces come off the 33:26 5K (10:46 /mi): reps a little quicker than that,
 * tempo a little slower. Each workout's parts add up to its `min`.
 */
const FAST = 'Fast is about 10:00 /mi.'
const STEADY = 'Steady is about 11:20 /mi, a few words at a time.'

type RunSpec = {
  label: RunPrescription['label']
  min: number
  notes?: string
  strides?: boolean
}

const easy = (min: number, strides = false): RunSpec => ({ label: 'Easy Run', min, strides })
const long = (min: number): RunSpec => ({ label: 'Long Run', min })

/**
 * Three runs a week: Monday easy after the lift, Wednesday the fast one,
 * Saturday the long one. Speed comes from Wednesday, distance from Saturday,
 * which grows five minutes a week. Weeks 4 and 8 back off; week 8 ends on a 5K
 * to measure the block.
 */
const RUNS: Record<number, { mon: RunSpec; wed: RunSpec; sat: RunSpec }> = {
  1: {
    mon: easy(20),
    wed: { label: 'Intervals', min: 30, notes: `8 min easy, 6 × 1 min fast / 2 min walk-jog, 4 min easy. ${FAST}` },
    sat: long(40),
  },
  2: {
    mon: easy(25),
    wed: { label: 'Intervals', min: 35, notes: `8 min easy, 8 × 1 min fast / 2 min walk-jog, 3 min easy. ${FAST}` },
    sat: long(45),
  },
  3: {
    mon: easy(25),
    wed: { label: 'Tempo Run', min: 35, notes: `10 min easy, 2 × 8 min steady with 3 min jog between, 6 min easy. ${STEADY}` },
    sat: long(50),
  },
  4: { mon: easy(20), wed: easy(25, true), sat: long(35) }, // deload
  5: {
    mon: easy(30),
    wed: { label: 'Intervals', min: 40, notes: `10 min easy, 5 × 3 min fast / 2 min walk-jog, 5 min easy. ${FAST}` },
    sat: long(55),
  },
  6: {
    mon: easy(30),
    wed: { label: 'Tempo Run', min: 40, notes: `10 min easy, 20 min steady, 10 min easy. ${STEADY}` },
    sat: long(60),
  },
  7: {
    mon: easy(30),
    wed: { label: 'Intervals', min: 45, notes: `10 min easy, 6 × 3 min fast / 2 min walk-jog, 5 min easy. ${FAST}` },
    sat: long(65),
  },
  8: {
    mon: easy(20),
    wed: easy(25, true),
    sat: { label: 'Time Trial', min: 45, notes: '10 min easy, then a 5K as fast as you can hold. The time to beat is 33:26.' },
  }, // deload, then the test
}

const DELOAD_WEEKS = new Set([4, 8])

const run = (spec: RunSpec, timing: RunPrescription['timing']): RunPrescription => ({
  label: spec.label,
  timing,
  durationMin: spec.min,
  ...HR[spec.label],
  strides: spec.strides ?? false,
  notes: spec.notes ?? null, // the strides copy is derived from `strides`, not duplicated per week
})

/**
 * The eight run-block weeks, anchored to `startMonday` (the Monday of week 1).
 * Every week has the same shape; only the runs change.
 */
export function baseWeeks(
  startMonday: string,
  ids: Record<TemplateSlug, number>,
  now: number,
): ProgramWeek[] {
  const weeks: ProgramWeek[] = []
  for (let n = BASE_FIRST_WEEK; n <= BASE_LAST_WEEK; n++) {
    const { mon, wed, sat } = RUNS[n]
    const slots: ProgramSlot[] = [
      { dow: 'mon', liftDayId: ids['upper-a'], run: run(mon, 'after-lift') },
      { dow: 'tue', liftDayId: ids['lower-a'], run: null },
      { dow: 'wed', liftDayId: null, run: run(wed, 'standalone') },
      { dow: 'thu', liftDayId: ids['upper-b'], run: null },
      { dow: 'fri', liftDayId: ids['lower-b'], run: null },
      { dow: 'sat', liftDayId: null, run: run(sat, 'standalone') },
      { dow: 'sun', liftDayId: null, run: null }, // rest
    ]
    weeks.push({
      id: n,
      phase: n <= 4 ? 'build-1' : 'build-2',
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
