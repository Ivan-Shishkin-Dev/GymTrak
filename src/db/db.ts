import Dexie, { type Table } from 'dexie'
import type {
  BodyWeight,
  Day,
  Exercise,
  PR,
  Session,
  WorkoutSet,
} from './types'

/**
 * IndexedDB store, accessed through Dexie. Indexed fields are listed in the
 * `stores` schema; the rest of each record is stored but not indexed.
 */
export class GymDB extends Dexie {
  days!: Table<Day, number>
  exercises!: Table<Exercise, string>
  sessions!: Table<Session, string>
  sets!: Table<WorkoutSet, string>
  bodyWeight!: Table<BodyWeight, string>
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
  }
}

export const db = new GymDB()

/** crypto.randomUUID is available in all PWA-capable browsers. */
export const uid = (): string => crypto.randomUUID()
