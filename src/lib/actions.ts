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

/** Set (or clear) the free-text comment on a set — the note added after a set. */
export async function setSetComment(setId: string, comment: string): Promise<void> {
  await db.sets.update(setId, {
    comment: comment.trim() || undefined,
    updatedAt: Date.now(),
  })
}

/* ── Home notepad ────────────────────────────────────────────────────────── */

/** Add a free-text training note. No-op on empty text. */
export async function addNote(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  const now = Date.now()
  await db.notes.add({ id: uid(), text: trimmed, createdAt: now, updatedAt: now })
}

/** Edit a note's text in place. */
export async function updateNote(id: string, text: string): Promise<void> {
  await db.notes.update(id, { text: text.trim(), updatedAt: Date.now() })
}

/** Soft-delete a note (kept for sync, filtered out everywhere). */
export async function deleteNote(id: string): Promise<void> {
  await db.notes.update(id, { deleted: true, updatedAt: Date.now() })
}

/* ── Personal records ────────────────────────────────────────────────────── */

/** Log a PR with the exact moment it was hit (`at` → both date and time). */
export async function addPR(
  lift: string,
  value: string,
  at: number = Date.now(),
): Promise<void> {
  const l = lift.trim()
  const v = value.trim()
  if (!l || !v) return
  const now = Date.now()
  await db.prs.add({
    id: uid(),
    lift: l,
    value: v,
    at,
    date: dateKey(new Date(at)),
    updatedAt: now,
  })
}

/** Soft-delete a PR. */
export async function deletePR(id: string): Promise<void> {
  await db.prs.update(id, { deleted: true, updatedAt: Date.now() })
}

/* ── Library editing ─────────────────────────────────────────────────────── */

/** Rename / re-focus a rotation day. */
export async function updateDay(
  id: number,
  patch: Partial<Pick<Day, 'name' | 'focus'>>,
): Promise<void> {
  await db.days.update(id, patch)
}

/** Patch an exercise's editable fields (name / sets / load / reps / note). */
export async function updateExercise(
  id: string,
  patch: Partial<Pick<Exercise, 'name' | 'sets' | 'weight' | 'reps' | 'note' | 'libLoad'>>,
): Promise<void> {
  await db.exercises.update(id, { ...patch, updatedAt: Date.now() })
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
    updatedAt: Date.now(),
  })
  return id
}

/** Remove an exercise from the library. */
export async function deleteExercise(id: string): Promise<void> {
  await db.exercises.delete(id)
}

/** The single open (unfinished) session, if any. */
export async function getActiveSession() {
  const all = await db.sessions.toArray()
  return all.find((s) => s.finishedAt == null && !s.deleted)
}

/**
 * Persist a finished session: duration and computed volume; incomplete
 * (un-ticked) sets are removed so history reflects what was done.
 */
export async function finishSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray()
  const now = Date.now()

  await db.transaction('rw', db.sessions, db.sets, async () => {
    // drop sets that weren't completed
    const undone = sets.filter((s) => s.completedAt == null).map((s) => s.id)
    if (undone.length) await db.sets.bulkDelete(undone)

    await db.sessions.update(sessionId, {
      finishedAt: now,
      durationSec: Math.round((now - session.startedAt) / 1000),
      updatedAt: now,
    })
  })
}
