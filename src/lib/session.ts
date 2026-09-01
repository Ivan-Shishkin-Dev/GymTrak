import { db } from '@/db/db'
import { RUN_DAY_ID } from '@/db/types'
import type { RunLog, Session, SessionType } from '@/db/types'

/**
 * Session kind helpers.
 *
 * Sessions predate the running program, so `type` is optional on the record and
 * absent means 'lift'. Every reader must go through `sessionType` rather than
 * touching `s.type` directly, or old sessions read as neither kind.
 */

export const sessionType = (s: Session): SessionType => s.type ?? 'lift'

export const isRun = (s: Session): boolean => sessionType(s) === 'run'

/**
 * THE open session, whatever its kind. Only one may exist app-wide (startSession
 * and startRun both discard the others), so this is a lookup, not a list.
 * Dexie can't index `null`, so we scan — same approach as actions.startSession.
 */
export async function openSession(): Promise<Session | undefined> {
  const all = await db.sessions.toArray()
  return all.find((s) => s.finishedAt == null && !s.deleted)
}

/** Where a live session should be resumed. Runs and lifts have separate screens. */
export const sessionRoute = (s: Session): string => (isRun(s) ? '/run' : '/log')

/** Above the hard cap. Flags the session in the UI; never blocks saving it. */
export const hrFlagged = (r: RunLog): boolean =>
  r.avgHr != null && r.avgHr > r.hrHardCap

/**
 * What to call a session in banners and confirm copy. Lifts need their day name
 * looked up by the caller; runs carry their own label, and `db.days.get(0)` would
 * return undefined for them (RUN_DAY_ID isn't a real day).
 */
export function sessionTitle(s: Session, dayName?: string): string {
  if (isRun(s)) return s.run?.label ?? 'run'
  return dayName ?? 'workout'
}

/** True when this session has no lift day behind it — i.e. don't try to load one. */
export const hasLiftDay = (s: Session): boolean => s.dayId !== RUN_DAY_ID
