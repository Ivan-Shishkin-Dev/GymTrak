import { db, uid } from '@/db/db'
import { dateKey, parseLoad, parseReps, getSetRows } from './format'
import type { Day, Exercise, WorkoutSet } from '@/db/types'

/** Open sessions older than this are treated as abandoned, not resumed. */
const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Ensure there's an in-progress session for `day` and return its id.
 *
 * A recent, same-day open session is resumed (so backing out of /log and coming
 * right back continues it, timer and all). Any open session that's stale (older
 * than RESUME_WINDOW_MS) or for a different day is abandoned and a fresh session
 * is started — so "Start workout" gives a clean, reset workout timer instead of
 * resuming one that's been running for hours.
 */
export async function startSession(
  day: Day,
  exercises: Exercise[],
): Promise<string> {
  const now = Date.now()
  // Dexie can't index `null`, so scan for open (unfinished) sessions directly.
  const openSessions = (await db.sessions.toArray()).filter(
    (s) => s.finishedAt == null && !s.deleted,
  )
  const resumable = openSessions.find(
    (s) => s.dayId === day.id && now - s.startedAt < RESUME_WINDOW_MS,
  )
  // Discard every open session we're not resuming — clears stale/abandoned ones.
  for (const s of openSessions) {
    if (s.id !== resumable?.id) await discardSession(s.id)
  }
  if (resumable) return resumable.id

  const sessionId = uid()
  const ordered = [...exercises].sort((a, b) => a.order - b.order)

  const sets: WorkoutSet[] = []
  for (const ex of ordered) {
    getSetRows(ex).forEach((row, i) => {
      sets.push({
        id: uid(),
        sessionId,
        exerciseId: ex.id,
        exerciseName: ex.name,
        setIndex: i,
        weight: row.weight,
        reps: row.reps,
        weightNum: parseLoad(row.weight),
        repsNum: parseReps(row.reps),
        completedAt: null,
        updatedAt: now,
      })
    })
  }

  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.add({
      id: sessionId,
      dayId: day.id,
      date: dateKey(new Date()),
      startedAt: now,
      finishedAt: null,
      durationSec: null,
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

/** Edit a set's performed load/reps in the Log; recomputes the numeric equivalents. */
export async function updateSetLoad(
  setId: string,
  weight: string,
  reps: string,
): Promise<void> {
  const w = weight.trim()
  const r = reps.trim()
  await db.sets.update(setId, {
    weight: w,
    reps: r,
    weightNum: parseLoad(w),
    repsNum: parseReps(r),
    updatedAt: Date.now(),
  })
}

/* ── Library editing ─────────────────────────────────────────────────────── */

/** Rename / re-focus a rotation day. */
export async function updateDay(
  id: number,
  patch: Partial<Pick<Day, 'name' | 'focus'>>,
): Promise<void> {
  await db.days.update(id, patch)
}

/** Append a new rotation day at the end of the cycle (next free id). Returns its id. */
export async function addDay(): Promise<number> {
  const existing = await db.days.toArray()
  const id = existing.reduce((m, d) => Math.max(m, d.id), 0) + 1
  await db.days.add({ id, name: 'New day', focus: '' })
  return id
}

/** Remove a rotation day and all of its exercises. Past sessions are kept. */
export async function deleteDay(id: number): Promise<void> {
  await db.transaction('rw', db.days, db.exercises, async () => {
    const exIds = (
      await db.exercises.where('dayId').equals(id).toArray()
    ).map((e) => e.id)
    if (exIds.length) await db.exercises.bulkDelete(exIds)
    await db.days.delete(id)
  })
}

/** Normalized name key for matching the same movement across rotation days. */
const normName = (s: string) => s.trim().toLowerCase()

/** Just the load scheme of an exercise — what carries across days when linked. */
function loadPatch(ex: Exercise): Partial<Exercise> {
  const patch: Partial<Exercise> = { sets: ex.sets, weight: ex.weight, reps: ex.reps }
  if (ex.setRows) patch.setRows = ex.setRows
  if (ex.loadType) patch.loadType = ex.loadType
  return patch
}

/**
 * Copy one exercise's whole load scheme onto every other exercise sharing its
 * name — the same movement on another rotation day. So progressing it on one day
 * (via carry-over or a Library edit) moves it everywhere. Matches case-insensitively
 * and writes siblings directly (no re-trigger, so no recursion).
 */
async function propagateLoad(
  srcId: string,
  name: string,
  patch: Partial<Exercise>,
  now: number,
): Promise<void> {
  const key = normName(name)
  const sibs = (await db.exercises.toArray()).filter(
    (e) => e.id !== srcId && normName(e.name) === key,
  )
  for (const e of sibs) await db.exercises.update(e.id, { ...patch, updatedAt: now })
}

/** Patch an exercise's editable fields (name / sets / load / reps / note / per-set rows). */
export async function updateExercise(
  id: string,
  patch: Partial<
    Pick<
      Exercise,
      'name' | 'sets' | 'weight' | 'reps' | 'note' | 'libLoad' | 'setRows' | 'loadType'
    >
  >,
): Promise<void> {
  const now = Date.now()
  await db.exercises.update(id, { ...patch, updatedAt: now })
  // If a load field changed, mirror the scheme onto same-named exercises on other days.
  const touchesLoad = ['setRows', 'weight', 'reps', 'sets', 'loadType'].some((k) => k in patch)
  if (touchesLoad) {
    const ex = await db.exercises.get(id)
    if (ex) await propagateLoad(id, ex.name, loadPatch(ex), now)
  }
}

/** Append a new exercise to a day, ordered after the current last one. */
export async function addExercise(
  dayId: number,
  partial?: Partial<Omit<Exercise, 'id' | 'dayId' | 'order' | 'updatedAt'>>,
): Promise<string> {
  const existing = await db.exercises.where('dayId').equals(dayId).toArray()
  const order = existing.reduce((m, e) => Math.max(m, e.order), 0) + 1
  const id = uid()
  await db.exercises.add({
    id,
    dayId,
    order,
    name: partial?.name ?? 'New exercise',
    sets: partial?.sets ?? 2,
    weight: partial?.weight ?? '',
    reps: partial?.reps ?? '× 6',
    note: partial?.note ?? '',
    libLoad: partial?.libLoad ?? '',
    loadType: partial?.loadType ?? 'weight',
    updatedAt: Date.now(),
  })
  return id
}

/** Remove an exercise from the library. */
export async function deleteExercise(id: string): Promise<void> {
  await db.exercises.delete(id)
}

/** Drop an abandoned (never-finished) session and its prefilled sets. */
async function discardSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    const ids = (
      await db.sets.where('sessionId').equals(sessionId).toArray()
    ).map((s) => s.id)
    if (ids.length) await db.sets.bulkDelete(ids)
    await db.sessions.delete(sessionId)
  })
}

/** The single open (unfinished) session, if any. */
export async function getActiveSession() {
  const all = await db.sessions.toArray()
  return all.find((s) => s.finishedAt == null && !s.deleted)
}

/**
 * Persist a finished session: duration and computed volume; incomplete
 * (un-ticked) sets are removed so history reflects what was done.
 *
 * Per-set carry-over: the Library is the source of truth for your loads, so each
 * exercise's sets this session (in order) are written back to its Library entry
 * as `setRows`. Different weights per set are remembered — next time you start
 * that day, every set prefills from what you used. The free-text Description
 * (libLoad) is left untouched.
 */
export async function finishSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray()
  const now = Date.now()

  // Group this session's sets by exercise so we can carry them back per set.
  const byExercise = new Map<string, WorkoutSet[]>()
  for (const s of sets) {
    const arr = byExercise.get(s.exerciseId)
    if (arr) arr.push(s)
    else byExercise.set(s.exerciseId, [s])
  }

  await db.transaction('rw', db.sessions, db.sets, db.exercises, async () => {
    // drop sets that weren't completed
    const undone = sets.filter((s) => s.completedAt == null).map((s) => s.id)
    if (undone.length) await db.sets.bulkDelete(undone)

    // carry each exercise's per-set loads back to its Library plan (no-op if deleted)
    for (const [exerciseId, exSets] of byExercise) {
      const setRows = [...exSets]
        .sort((a, b) => a.setIndex - b.setIndex)
        .map((s) => ({ weight: s.weight, reps: s.reps }))
      if (!setRows.length) continue
      const ex = await db.exercises.get(exerciseId)
      const patch: Partial<Exercise> = {
        setRows,
        sets: setRows.length,
        weight: setRows[0].weight,
        reps: setRows[0].reps,
      }
      if (ex?.loadType) patch.loadType = ex.loadType
      await db.exercises.update(exerciseId, { ...patch, updatedAt: now })
      // Linked days: the same movement on other days tracks the same load.
      if (ex) await propagateLoad(exerciseId, ex.name, patch, now)
    }

    await db.sessions.update(sessionId, {
      finishedAt: now,
      durationSec: Math.round((now - session.startedAt) / 1000),
      updatedAt: now,
    })
  })
}
