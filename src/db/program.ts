import { addDays, parseISO } from 'date-fns'
import { db, uid } from './db'
import { dateKey } from '@/lib/format'
import { isEditMode } from '@/lib/sync'
import { dayRank } from '@/lib/rotation'
import type {
  Day,
  Dow,
  Exercise,
  LoadType,
  ProgramSlot,
  ProgramWeek,
  RunPrescription,
  SetRow,
} from './types'

/**
 * The running Base Phase (weeks 9–16) and the installer that puts it into a
 * database that already has data.
 *
 * Why an installer and not a seed: `seedIfEmpty` no-ops once `days` has rows, and
 * with Supabase configured it is never called at all — so editing the seed cannot
 * reach an existing install. And it can't be a Dexie `.upgrade()` either, because
 * `applySnapshot` clears and rebuilds every table from the cloud on the next pull,
 * which would silently undo it. So: an explicit, idempotent, edit-mode-gated
 * action, run from a button in the Library after sync has settled.
 */

export type TemplateSlug = 'upper-a' | 'lower-a' | 'upper-b' | 'lower-b'

type ExerciseSpec = { name: string; loadType: LoadType; setRows: SetRow[] }
type TemplateSpec = {
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

/* ── Install ──────────────────────────────────────────────────────────────── */

export type InstallReport = {
  daysCreated: number
  exercisesCreated: number
  weeksWritten: number
  daysArchived: number
  cardioRemoved: number
}

function requireEdit(): void {
  if (!isEditMode()) throw new Error('Read-only: enter the edit password first.')
}

/** Anything named "Cardio" — the generic placeholder the run plan supersedes. */
const isCardio = (e: Exercise): boolean => /^\s*cardio\b/i.test(e.name)

/**
 * Install (or re-install) the Base Phase. Idempotent by construction:
 *
 *  • templates are matched by `slug`, so a re-run reuses the same day
 *  • exercises are only seeded into a day that has none — critical, because
 *    `finishSession` writes your real progressed loads back into `setRows` within
 *    days of installing, and a re-run must never reset them
 *  • weeks are `bulkPut` keyed by week number, so duplicates are impossible
 *  • `startDate` is only rewritten when `reanchor` is set
 *
 * The destructive options default off and are driven by separate, confirmed
 * buttons in the Library.
 */
export async function installBasePhase(opts: {
  startMonday: string
  reanchor?: boolean
  archiveLegacy?: boolean
  removeCardio?: boolean
}): Promise<InstallReport> {
  requireEdit()
  const now = Date.now()
  const report: InstallReport = {
    daysCreated: 0,
    exercisesCreated: 0,
    weeksWritten: 0,
    daysArchived: 0,
    cardioRemoved: 0,
  }

  await db.transaction(
    'rw',
    [db.days, db.exercises, db.sessions, db.sets, db.programWeeks],
    async () => {
      const existing = await db.days.toArray()
      let nextId = existing.reduce((m, d) => Math.max(m, d.id), 0) + 1
      let nextOrder = existing.reduce((m, d) => Math.max(m, dayRank(d)), 0) + 1

      const ids = {} as Record<TemplateSlug, number>

      for (const t of BASE_TEMPLATES) {
        const found = existing.find((d) => d.slug === t.slug)
        if (found) {
          ids[t.slug] = found.id
        } else {
          const day: Day = {
            id: nextId++,
            order: nextOrder++,
            name: t.name,
            focus: t.focus,
            slug: t.slug,
          }
          await db.days.add(day)
          ids[t.slug] = day.id
          report.daysCreated++
        }

        // Only seed into an empty day. A populated one holds progressed loads.
        const count = await db.exercises.where('dayId').equals(ids[t.slug]).count()
        if (count === 0) {
          const rows: Exercise[] = t.exercises.map((e, i) => ({
            id: uid(),
            dayId: ids[t.slug],
            order: i + 1,
            name: e.name,
            sets: e.setRows.length,
            weight: e.setRows[0].weight, // first-set fallback when setRows is absent
            reps: e.setRows[0].reps,
            setRows: e.setRows,
            loadType: e.loadType,
            updatedAt: now,
          }))
          await db.exercises.bulkAdd(rows)
          report.exercisesCreated += rows.length
        }
      }

      // Weeks. Keep each existing week's anchor unless explicitly re-anchoring,
      // so a second press can refresh the prescriptions without shoving the
      // calendar out from under a phase already in progress.
      const prior = await db.programWeeks.toArray()
      const weeks = baseWeeks(opts.startMonday, ids, now).map((w) => {
        const old = prior.find((p) => p.id === w.id)
        return old && !opts.reanchor ? { ...w, startDate: old.startDate } : w
      })
      await db.programWeeks.bulkPut(weeks)
      report.weeksWritten = weeks.length

      // Archive the legacy split. Slug-less ⇒ pre-program, so a re-run can never
      // archive the four templates this installer just created.
      if (opts.archiveLegacy) {
        for (const d of existing) {
          if (!d.slug && !d.archived) {
            await db.days.update(d.id, { archived: true })
            report.daysArchived++
          }
        }
      }

      // Remove the generic Cardio line item, superseded by real run sessions.
      if (opts.removeCardio) {
        const cardio = (await db.exercises.toArray()).filter(isCardio)
        if (cardio.length) {
          const exIds = new Set(cardio.map((e) => e.id))
          // Only prune sets belonging to a session still open. A finished
          // session's sets are history and stay exactly as they were logged.
          const openIds = new Set(
            (await db.sessions.toArray())
              .filter((s) => s.finishedAt == null && !s.deleted)
              .map((s) => s.id),
          )
          const stale = (await db.sets.toArray()).filter(
            (st) => exIds.has(st.exerciseId) && openIds.has(st.sessionId),
          )
          if (stale.length) await db.sets.bulkDelete(stale.map((x) => x.id))
          await db.exercises.bulkDelete([...exIds])
          report.cardioRemoved = cardio.length
        }
      }
    },
  )

  return report
}

/** Re-anchor the whole phase to a new Monday, keeping everything else. */
export async function setProgramStart(startMonday: string): Promise<void> {
  requireEdit()
  const now = Date.now()
  const weeks = await db.programWeeks.toArray()
  await db.programWeeks.bulkPut(
    weeks.map((w) => ({
      ...w,
      startDate: dateKey(
        addDays(parseISO(startMonday), (w.id - BASE_FIRST_WEEK) * 7),
      ),
      updatedAt: now,
    })),
  )
}

/** How many Cardio line items are sitting in the library right now. */
export async function countCardio(): Promise<number> {
  return (await db.exercises.toArray()).filter(isCardio).length
}

