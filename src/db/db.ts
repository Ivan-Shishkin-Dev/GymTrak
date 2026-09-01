import Dexie, { type Table } from 'dexie'
import type { Day, Exercise, ProgramWeek, Session, WorkoutSet } from './types'

/**
 * IndexedDB store, accessed through Dexie. Indexed fields are listed in the
 * `stores` schema; the rest of each record is stored but not indexed.
 */
export class GymDB extends Dexie {
  days!: Table<Day, number>
  exercises!: Table<Exercise, string>
  sessions!: Table<Session, string>
  sets!: Table<WorkoutSet, string>
  programWeeks!: Table<ProgramWeek, number>

  constructor() {
    super('gymtrak')
    this.version(1).stores({
      days: 'id, weekday',
      exercises: 'id, dayId, [dayId+order]',
      sessions: 'id, date, dayId, finishedAt',
      sets: 'id, sessionId, exerciseId, completedAt',
      bodyWeight: 'id, date',
      prs: 'id, date',
    })
    // v2: drop the PRs table (feature removed). `null` deletes the object store
    // on upgrade so existing installs migrate cleanly.
    this.version(2).stores({ prs: null })
    // v3: drop the body-weight store and remove the `weekday` index from `days`.
    this.version(3).stores({ bodyWeight: null, days: 'id' })
    // v4: add the Home notepad and re-introduce PRs (logged with date + time).
    // The per-set `comment` field is non-indexed, so it needs no schema change.
    this.version(4).stores({ notes: 'id, createdAt', prs: 'id, date, at' })
    // v5: remove the PRs feature again — `null` drops the object store on upgrade.
    this.version(5).stores({ prs: null })
    // v6: remove the notes feature (Home notepad + per-set comments) — drop the store.
    this.version(6).stores({ notes: null })
    // v7: the running program — one row per program week, holding its Mon–Sun slots
    // and run prescriptions. `id` IS the week number, so re-seeding is an idempotent
    // put. Only 8 rows and every consumer loads all of them, so `id` is the only
    // index. `days.slug` / `days.archived` and the new `sessions` program fields are
    // non-indexed, so they need no schema change (see the note below).
    this.version(7).stores({ programWeeks: 'id' })
    // Note: `exercises.loadType` (added later) is a non-indexed field — Dexie
    // stores it without a schema change, so no version bump is needed for it.
  }
}

export const db = new GymDB()

/** crypto.randomUUID is available in all PWA-capable browsers. */
export const uid = (): string => crypto.randomUUID()
