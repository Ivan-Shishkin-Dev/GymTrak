import { db } from './db'
import { dateKey } from '@/lib/format'
import {
  BASE_TEMPLATES,
  baseWeeks,
  templateExercises,
  upcomingMonday,
  type TemplateSlug,
} from './templates'
import type { Day, Exercise } from './types'

/**
 * Seed on first launch only (when the DB is empty). Idempotent: if `days`
 * already has rows it does nothing, so reopening the app never duplicates data.
 *
 * Seeds the split as it is trained today — the four consolidated lift days from
 * `templates.ts` — and the Base Phase weeks anchored to the upcoming Monday, so a
 * fresh install opens on a scheduled week rather than an empty Home. The four
 * days carry their template `slug`, which is what lets a later "Install base
 * phase" recognise them instead of creating duplicates.
 */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.days.count()
  if (count > 0) return

  const now = Date.now()
  const days: Day[] = []
  const exercises: Exercise[] = []
  const ids = {} as Record<TemplateSlug, number>

  BASE_TEMPLATES.forEach((t, i) => {
    const id = i + 1
    ids[t.slug] = id
    days.push({ id, order: id, name: t.name, focus: t.focus, slug: t.slug, updatedAt: now })
    exercises.push(...templateExercises(t, id, now))
  })
  const weeks = baseWeeks(dateKey(upcomingMonday(new Date(now))), ids, now)

  await db.transaction('rw', [db.days, db.exercises, db.programWeeks], async () => {
    await db.days.bulkAdd(days)
    await db.exercises.bulkAdd(exercises)
    await db.programWeeks.bulkAdd(weeks)
  })
}
