import { db, uid } from '@/db/db'
import { dateKey, parseLoad, parseReps } from './format'
import type { Day, Exercise, WorkoutSet } from '@/db/types'

/**
 * Ensure there's an in-progress session for `day` and return its id.
 * If one is already open (finished == null) it's resumed rather than duplicated,
 * so backing out of /log and reopening continues the same session.
 */
export async function startSession(
  day: Day,
  exercises: Exercise[],
): Promise<string> {
  // Dexie can't index `null`, so scan for an already-open session directly.
  const open = await getActiveSession()
  if (open) return open.id

  const now = Date.now()
  const sessionId = uid()
  const ordered = [...exercises].sort((a, b) => a.order - b.order)

  const sets: WorkoutSet[] = []
  for (const ex of ordered) {
    for (let i = 0; i < ex.sets; i++) {
      sets.push({
        id: uid(),
        sessionId,
        exerciseId: ex.id,
        exerciseName: ex.name,
        setIndex: i,
        weight: ex.weight,
        reps: ex.reps,
        weightNum: parseLoad(ex.weight),
        repsNum: parseReps(ex.reps),
        completedAt: null,
        updatedAt: now,
      })
    }
  }

  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.add({
      id: sessionId,
      dayId: day.id,
      date: dateKey(new Date()),
      startedAt: now,
      finishedAt: null,
      durationSec: null,
      totalVolume: null,
      updatedAt: now,
    })
    await db.sets.bulkAdd(sets)
  })

  return sessionId
}

/** Toggle a set done/undone. Returns true if it is now done (so the caller can start rest). */
export async function toggleSet(setId: string): Promise<boolean> {
  const set = await db.sets.get(setId)
  if (!set) return false
  const nowDone = set.completedAt == null
  await db.sets.update(setId, {
    completedAt: nowDone ? Date.now() : null,
    updatedAt: Date.now(),
  })
  return nowDone
}

/** The single open (unfinished) session, if any. */
export async function getActiveSession() {
  const all = await db.sessions.toArray()
  return all.find((s) => s.finishedAt == null && !s.deleted)
}

function volumeOf(sets: WorkoutSet[]): number {
  return sets
    .filter((s) => s.completedAt != null && s.weightNum != null && s.repsNum != null)
    .reduce((sum, s) => sum + (s.weightNum as number) * (s.repsNum as number), 0)
}

/**
 * Persist a finished session: duration, computed volume, and any new PRs;
 * incomplete (un-ticked) sets are removed so history reflects what was done.
 */
export async function finishSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray()
  const done = sets.filter((s) => s.completedAt != null)
  const now = Date.now()

  await db.transaction('rw', db.sessions, db.sets, db.prs, async () => {
    // drop sets that weren't completed
    const undone = sets.filter((s) => s.completedAt == null).map((s) => s.id)
    if (undone.length) await db.sets.bulkDelete(undone)

    await db.sessions.update(sessionId, {
      finishedAt: now,
      durationSec: Math.round((now - session.startedAt) / 1000),
      totalVolume: volumeOf(done),
      updatedAt: now,
    })

    await updatePRs(done, now)
  })
}

/** Naive PR detection: a completed set beats the stored best for its exercise. */
async function updatePRs(done: WorkoutSet[], now: number): Promise<void> {
  // best numeric set per exercise this session
  const best = new Map<string, WorkoutSet>()
  for (const s of done) {
    if (s.weightNum == null) continue
    const cur = best.get(s.exerciseName)
    if (
      !cur ||
      (s.weightNum as number) > (cur.weightNum as number) ||
      ((s.weightNum as number) === (cur.weightNum as number) &&
        (s.repsNum ?? 0) > (cur.repsNum ?? 0))
    ) {
      best.set(s.exerciseName, s)
    }
  }

  const existing = await db.prs.toArray()
  for (const [name, s] of best) {
    const prior = existing.find((p) => p.name === name)
    const priorWeight = prior ? parseLoad(prior.load.split('×')[0]) : null
    const beats = priorWeight == null || (s.weightNum as number) > priorWeight
    if (!beats) continue
    const load = `${s.weight.replace(/\s*lb$/, '')} ${s.reps}`.trim()
    if (prior) {
      await db.prs.update(prior.id, { load, date: dateKey(new Date()), updatedAt: now })
    } else {
      await db.prs.add({
        id: uid(),
        exerciseId: s.exerciseId,
        name,
        load,
        date: dateKey(new Date()),
        updatedAt: now,
      })
    }
  }
}
