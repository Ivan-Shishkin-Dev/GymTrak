import { addDays, parseISO } from 'date-fns'
import { db } from './db'
import { dateKey } from '@/lib/format'
import { isEditMode } from '@/lib/sync'
import { dayRank } from '@/lib/rotation'
import {
  BASE_FIRST_WEEK,
  BASE_TEMPLATES,
  baseWeeks,
  templateExercises,
  type TemplateSlug,
} from './templates'
import type { Day, Exercise } from './types'

export {
  BASE_FIRST_WEEK,
  BASE_LAST_WEEK,
  BASE_TEMPLATES,
  baseWeeks,
  upcomingMonday,
} from './templates'
export type { TemplateSlug } from './templates'

/**
 * The installer that puts the split and its Base Phase (weeks 9–16) into a
 * database that already has data. The templates themselves live in
 * `templates.ts`, shared with the first-launch seed.
 *
 * Why an installer and not only a seed: `seedIfEmpty` no-ops once `days` has
 * rows, and with Supabase configured it is never called at all — so editing the
 * seed cannot reach an existing install. And it can't be a Dexie `.upgrade()`
 * either, because `applySnapshot` clears and rebuilds every table from the cloud
 * on the next pull, which would silently undo it. So: an explicit, idempotent,
 * edit-mode-gated action, run from a button in the Library after sync has
 * settled.
 */

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
          const rows = templateExercises(t, ids[t.slug], now)
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
