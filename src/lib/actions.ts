import { db, uid } from '@/db/db'
import { dateKey, parseLoad, parseReps, getSetRows } from './format'
import { isEditMode } from './sync'
import { dayRank, byDayOrder } from './rotation'
import type { Day, Exercise, WorkoutSet } from '@/db/types'

/** Open sessions older than this are treated as abandoned, not resumed. */
export const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Write guard. Every mutating action funnels through here, so a view-only visitor
 * (no edit password) can't change local data and quietly diverge from the public
 * cloud snapshot. The real enforcement is server-side (RLS + the save_state RPC);
 * this just keeps the local DB honest. The UI hides edit controls when locked, so
 * this should never actually throw in normal use.
 */
function requireEdit(): void {
  if (!isEditMode()) throw new Error('Read-only: enter the edit password first.')
}

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
  requireEdit()
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
  requireEdit()
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
  requireEdit()
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
  requireEdit()
  await db.days.update(id, patch)
}

/** Append a new rotation day at the end of the cycle (next free id). Returns its id. */
export async function addDay(): Promise<number> {
  requireEdit()
  const existing = await db.days.toArray()
  const id = existing.reduce((m, d) => Math.max(m, d.id), 0) + 1
  const order = existing.reduce((m, d) => Math.max(m, dayRank(d)), 0) + 1
  await db.days.add({ id, order, name: 'New day', focus: '' })
  return id
}

/**
 * Reorder a rotation day one slot earlier (-1) or later (+1). Renumbers every
 * day's `order` to a contiguous 1..n run, which also backfills `order` on legacy
 * days that only had an `id`. No-op at the ends of the cycle.
 */
export async function moveDay(id: number, dir: -1 | 1): Promise<void> {
  requireEdit()
  const days = (await db.days.toArray()).sort(byDayOrder)
  const idx = days.findIndex((d) => d.id === id)
  const target = idx + dir
  if (idx === -1 || target < 0 || target >= days.length) return
  ;[days[idx], days[target]] = [days[target], days[idx]]
  await db.transaction('rw', db.days, async () => {
    for (let i = 0; i < days.length; i++) {
      if (days[i].order !== i + 1) await db.days.update(days[i].id, { order: i + 1 })
    }
  })
}

/** Remove a rotation day and all of its exercises. Past sessions are kept. */
export async function deleteDay(id: number): Promise<void> {
  requireEdit()
  await db.transaction('rw', db.days, db.exercises, async () => {
    const exIds = (
      await db.exercises.where('dayId').equals(id).toArray()
    ).map((e) => e.id)
    if (exIds.length) await db.exercises.bulkDelete(exIds)
    await db.days.delete(id)
  })
}

/** Patch an exercise's editable fields (name / sets / load / reps / note / per-set rows).
    Each exercise is independent — same-named exercises on other days are NOT touched
    (cross-day propagation was removed after proving faulty). */
export async function updateExercise(
  id: string,
  patch: Partial<
    Pick<
      Exercise,
      'name' | 'sets' | 'weight' | 'reps' | 'note' | 'libLoad' | 'setRows' | 'loadType'
    >
  >,
): Promise<void> {
  requireEdit()
  await db.exercises.update(id, { ...patch, updatedAt: Date.now() })
}

/** Append a new exercise to a day, ordered after the current last one. */
export async function addExercise(
  dayId: number,
  partial?: Partial<Omit<Exercise, 'id' | 'dayId' | 'order' | 'updatedAt'>>,
): Promise<string> {
  requireEdit()
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
  requireEdit()
  await db.exercises.delete(id)
}

/**
 * Reorder an exercise one slot up (-1) or down (+1) within its day. Renumbers the
 * day's exercises to a contiguous 1..n `order` run. Touches only `order` (not the
 * load fields), so cross-day links are unaffected. No-op at the ends.
 */
export async function moveExercise(id: string, dir: -1 | 1): Promise<void> {
  requireEdit()
  const ex = await db.exercises.get(id)
  if (!ex) return
  const sibs = (await db.exercises.where('dayId').equals(ex.dayId).toArray()).sort(
    (a, b) => a.order - b.order,
  )
  const idx = sibs.findIndex((e) => e.id === id)
  const target = idx + dir
  if (idx === -1 || target < 0 || target >= sibs.length) return
  ;[sibs[idx], sibs[target]] = [sibs[target], sibs[idx]]
  const now = Date.now()
  await db.transaction('rw', db.exercises, async () => {
    for (let i = 0; i < sibs.length; i++) {
      if (sibs[i].order !== i + 1) {
        await db.exercises.update(sibs[i].id, { order: i + 1, updatedAt: now })
      }
    }
  })
}

/* ── In-workout structural editing ───────────────────────────────────────── */

/**
 * Add one more set to an exercise mid-workout. Appends a `WorkoutSet` after the
 * exercise's existing sets in this session, copying the last set's load/reps as a
 * sensible default. The Library set count catches up on finish (carry-over).
 */
export async function addSetToSession(
  sessionId: string,
  exerciseId: string,
): Promise<void> {
  requireEdit()
  const exSets = (await db.sets.where('sessionId').equals(sessionId).toArray())
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => a.setIndex - b.setIndex)
  const last = exSets[exSets.length - 1]
  const now = Date.now()
  await db.sets.add({
    id: uid(),
    sessionId,
    exerciseId,
    exerciseName: last?.exerciseName ?? '',
    setIndex: (last?.setIndex ?? -1) + 1,
    weight: last?.weight ?? '',
    reps: last?.reps ?? '× 6',
    weightNum: last ? parseLoad(last.weight) : null,
    repsNum: last ? parseReps(last.reps) : null,
    completedAt: null,
    updatedAt: now,
  })
}

/** Remove a single set from the live workout. Keeps at least one set per exercise. */
export async function removeSet(setId: string): Promise<void> {
  requireEdit()
  const set = await db.sets.get(setId)
  if (!set) return
  const exSets = (await db.sets.where('sessionId').equals(set.sessionId).toArray()).filter(
    (s) => s.exerciseId === set.exerciseId,
  )
  if (exSets.length <= 1) return // last set — delete the exercise instead
  await db.sets.delete(setId)
}

/**
 * Add a new exercise to the day mid-workout. Creates the Library entry (so it
 * sticks for next time) and seeds this session's sets from it so it shows up in
 * the live workout immediately. Returns the new exercise id.
 */
export async function addExerciseToSession(
  sessionId: string,
  dayId: number,
): Promise<string> {
  requireEdit()
  const exId = await addExercise(dayId)
  const ex = await db.exercises.get(exId)
  if (!ex) return exId
  const now = Date.now()
  const sets: WorkoutSet[] = getSetRows(ex).map((row, i) => ({
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
  }))
  if (sets.length) await db.sets.bulkAdd(sets)
  return exId
}

/**
 * Remove an exercise from the live workout and the plan. Drops its sets in this
 * session, then deletes the Library entry.
 */
export async function removeExerciseFromSession(
  sessionId: string,
  exerciseId: string,
): Promise<void> {
  requireEdit()
  const ids = (await db.sets.where('sessionId').equals(sessionId).toArray())
    .filter((s) => s.exerciseId === exerciseId)
    .map((s) => s.id)
  await db.transaction('rw', db.sets, db.exercises, async () => {
    if (ids.length) await db.sets.bulkDelete(ids)
    await db.exercises.delete(exerciseId)
  })
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
  requireEdit()
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
    }

    await db.sessions.update(sessionId, {
      finishedAt: now,
      durationSec: Math.round((now - session.startedAt) / 1000),
      updatedAt: now,
    })
  })
}
