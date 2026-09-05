import { db, uid } from '@/db/db'
import { addDays, parseISO } from 'date-fns'
import { dateKey, parseLoad, parseReps, getSetRows } from './format'
import { isEditMode } from './sync'
import { dayRank, byDayOrder } from './rotation'
import { RUN_DAY_ID } from '@/db/types'
import type {
  Day,
  Exercise,
  ProgramSlot,
  ProgramWeek,
  RunPrescription,
  Session,
  WorkoutSet,
} from '@/db/types'

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
async function claimOpenSession(
  isResumable: (s: Session) => boolean,
): Promise<string | null> {
  // Dexie can't index `null`, so scan for open (unfinished) sessions directly.
  const openSessions = (await db.sessions.toArray()).filter(
    (s) => s.finishedAt == null && !s.deleted,
  )
  const resumable = openSessions.find(isResumable)
  // Discard every open session we're not resuming — clears stale/abandoned ones.
  for (const s of openSessions) {
    if (s.id !== resumable?.id) await discardSession(s.id)
  }
  return resumable?.id ?? null
}

export async function startSession(
  day: Day,
  exercises: Exercise[],
  opts?: { deload?: boolean; weekNumber?: number; scheduledDate?: string },
): Promise<string> {
  requireEdit()
  const now = Date.now()
  const scheduledDate = opts?.scheduledDate ?? dateKey(new Date(now))
  const resumed = await claimOpenSession(
    (s) => s.dayId === day.id && (s.scheduledDate ?? s.date) === scheduledDate && now - s.startedAt < RESUME_WINDOW_MS,
  )
  if (resumed) return resumed

  const sessionId = uid()
  const ordered = [...exercises].sort((a, b) => a.order - b.order)

  const sets: WorkoutSet[] = []
  for (const ex of ordered) {
    // Deload drops the last working set, but only where there's real volume to
    // drop — trimming a 2-set exercise to a single set isn't a deload, it's a
    // different session. Weights are untouched either way.
    const all = getSetRows(ex)
    const rows = opts?.deload && all.length >= 3 ? all.slice(0, all.length - 1) : all
    rows.forEach((row, i) => {
      sets.push({
        id: uid(),
        sessionId,
        exerciseId: ex.id,
        exerciseName: ex.name,
        setIndex: i,
        weight: row.weight,
        reps: row.reps,
        targetWeight: row.weight,
        targetReps: row.reps,
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
      ...(opts?.scheduledDate ? { scheduledDate: opts.scheduledDate } : {}),
      dayNameSnapshot: day.name,
      focusSnapshot: day.focus,
      startedAt: now,
      finishedAt: null,
      durationSec: null,
      updatedAt: now,
      type: 'lift',
      ...(opts?.weekNumber != null ? { weekNumber: opts.weekNumber } : {}),
      ...(opts?.deload ? { deload: true } : {}),
    })
    await db.sets.bulkAdd(sets)
  })

  return sessionId
}

/**
 * Start a run from its prescription. A run session carries no `sets` rows at all
 * — its whole record is the clock and the RunLog — so it lives on /run rather
 * than /log, and `dayId` is the RUN_DAY_ID sentinel because there's no lift day.
 *
 * The prescription is COPIED onto the session rather than referenced, so editing
 * or re-anchoring the program later can't rewrite what you actually ran.
 */
export async function startRun(
  week: ProgramWeek,
  slot: ProgramSlot,
  scheduledDate?: string,
): Promise<string | null> {
  requireEdit()
  if (!slot.run) return null
  const now = Date.now()
  const p: RunPrescription = slot.run
  const plannedDate = scheduledDate ?? dateKey(new Date(now))

  const resumed = await claimOpenSession(
    (s) => s.dayId === RUN_DAY_ID && (s.scheduledDate ?? s.date) === plannedDate && now - s.startedAt < RESUME_WINDOW_MS,
  )
  if (resumed) return resumed

  const sessionId = uid()
  await db.sessions.add({
    id: sessionId,
    dayId: RUN_DAY_ID,
    date: dateKey(new Date()),
    ...(scheduledDate ? { scheduledDate } : {}),
    dayNameSnapshot: p.label,
    focusSnapshot: 'Zone 2',
    startedAt: now,
    finishedAt: null,
    durationSec: null,
    updatedAt: now,
    type: 'run',
    weekNumber: week.id,
    ...(week.isDeload ? { deload: true } : {}),
    run: {
      label: p.label,
      dow: slot.dow,
      plannedMin: p.durationMin,
      hrZoneMin: p.hrZoneMin,
      hrZoneMax: p.hrZoneMax,
      hrHardCap: p.hrHardCap,
      strides: p.strides,
      actualMin: null,
      actualMi: null,
      avgHr: null,
      notes: p.notes,
    },
  })
  return sessionId
}

/**
 * Finish a run. Both metrics are optional — a run with no watch reading is still
 * a run, and an average HR over the hard cap flags the session without ever
 * blocking the save.
 */
export async function finishRun(
  sessionId: string,
  metrics: { actualMin: number | null; actualMi: number | null; avgHr: number | null },
): Promise<void> {
  requireEdit()
  const session = await db.sessions.get(sessionId)
  if (!session?.run) return
  const now = Date.now()
  await db.sessions.update(sessionId, {
    finishedAt: now,
    durationSec: Math.round((now - session.startedAt) / 1000),
    updatedAt: now,
    run: { ...session.run, ...metrics },
  })
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
  await db.days.update(id, { ...patch, updatedAt: Date.now() })
}

/**
 * Hide a day from the Library without deleting it. Past sessions reference days
 * by `dayId`, so archiving (rather than `deleteDay`) keeps every historical
 * session resolvable — and makes rolling back to the old split one tap.
 */
export async function archiveDay(id: number, archived: boolean): Promise<void> {
  requireEdit()
  await db.days.update(id, { archived, updatedAt: Date.now() })
}

/** Append a new rotation day at the end of the cycle (next free id). Returns its id. */
export async function addDay(): Promise<number> {
  requireEdit()
  const existing = await db.days.toArray()
  const id = existing.reduce((m, d) => Math.max(m, d.id), 0) + 1
  const order = existing.reduce((m, d) => Math.max(m, dayRank(d)), 0) + 1
  await db.days.add({ id, order, name: 'New day', focus: '', updatedAt: Date.now() })
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
      if (days[i].order !== i + 1) {
        await db.days.update(days[i].id, { order: i + 1, updatedAt: Date.now() })
      }
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

/** Patch an exercise's editable fields (name / sets / load / reps / per-set rows).
    Each exercise is independent — same-named exercises on other days are NOT touched
    (cross-day propagation was removed after proving faulty). */
export async function updateExercise(
  id: string,
  patch: Partial<
    Pick<Exercise, 'name' | 'sets' | 'weight' | 'reps' | 'setRows' | 'loadType' | 'loadIncrement' | 'restSeconds'>
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
    targetWeight: last?.weight ?? '',
    targetReps: last?.reps ?? '× 6',
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
    targetWeight: row.weight,
    targetReps: row.reps,
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
export async function discardSession(sessionId: string): Promise<void> {
  requireEdit()
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
 * that day, every set prefills from what you used.
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
    // Keep incomplete rows so a just-finished workout can be reopened without
    // reconstructing its plan. History only renders completed rows.

    // Carry completed work back to the Library plan (no-op if deleted).
    for (const [exerciseId, exSets] of byExercise) {
      const orderedRows = [...exSets].sort((a, b) => a.setIndex - b.setIndex)
      // Completed rows carry their performed values. Unfinished rows retain the
      // start-of-session target, so ending early never promotes an accidental
      // edit or silently shrinks the next prescription.
      const setRows = orderedRows.map((s) => s.completedAt != null
        ? { weight: s.weight, reps: s.reps }
        : { weight: s.targetWeight ?? s.weight, reps: s.targetReps ?? s.reps })
      if (!setRows.length) continue
      const ex = await db.exercises.get(exerciseId)
      // A deload session deliberately runs a set short. Carry back the loads you
      // actually used, but keep the plan's trailing set(s) — otherwise finishing
      // a deload would permanently shrink the template, and you'd come back the
      // following block quietly running less volume than the program says.
      const prev = ex?.setRows ?? []
      const merged =
        session.deload && prev.length > setRows.length
          ? [...setRows, ...prev.slice(setRows.length)]
          : setRows
      const patch: Partial<Exercise> = {
        setRows: merged,
        sets: merged.length,
        weight: merged[0].weight,
        reps: merged[0].reps,
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

/** Reopen a just-finished session for the short post-finish undo action. */
export async function reopenSession(sessionId: string): Promise<Session | null> {
  requireEdit()
  const session = await db.sessions.get(sessionId)
  if (!session || session.deleted) return null
  await db.sessions.update(sessionId, {
    finishedAt: null,
    durationSec: null,
    updatedAt: Date.now(),
  })
  return { ...session, finishedAt: null, durationSec: null }
}

/** Soft-delete a completed session while retaining a recovery path in synced data. */
export async function deleteSession(sessionId: string): Promise<void> {
  requireEdit()
  await db.sessions.update(sessionId, { deleted: true, updatedAt: Date.now() })
}

/** Save edits to a current or future program week. */
export async function updateProgramWeek(week: ProgramWeek): Promise<void> {
  requireEdit()
  await db.programWeeks.put({ ...week, updatedAt: Date.now() })
}

/** Append a new week after the phase, using another week as its template. */
export async function duplicateProgramWeek(sourceId: number): Promise<number | null> {
  requireEdit()
  const weeks = (await db.programWeeks.toArray()).sort((a, b) => a.id - b.id)
  const source = weeks.find((w) => w.id === sourceId)
  const last = weeks[weeks.length - 1]
  if (!source || !last) return null
  const id = last.id + 1
  await db.programWeeks.add({
    ...source,
    id,
    startDate: dateKey(addDays(parseISO(last.startDate), 7)),
    slots: source.slots.map((slot) => ({
      ...slot,
      run: slot.run ? { ...slot.run } : null,
    })),
    updatedAt: Date.now(),
  })
  return id
}
