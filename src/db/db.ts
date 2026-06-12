import Dexie, { type Table } from 'dexie'
import type { Day, Exercise, Note, PR, Session, WorkoutSet } from './types'

/**
 * IndexedDB store, accessed through Dexie. Indexed fields are listed in the
 * `stores` schema; the rest of each record is stored but not indexed.
 */
export class GymDB extends Dexie {
  days!: Table<Day, number>
  exercises!: Table<Exercise, string>
  sessions!: Table<Session, string>
  sets!: Table<WorkoutSet, string>
  notes!: Table<Note, string>
  prs!: Table<PR, string>

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
  }
}

export const db = new GymDB()

/** crypto.randomUUID is available in all PWA-capable browsers. */
export const uid = (): string => crypto.randomUUID()
