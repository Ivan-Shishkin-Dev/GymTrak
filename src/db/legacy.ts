import type { Day, Exercise, ProgramWeek, Session, WorkoutSet } from './types'

type SplitData = {
  days: Day[]
  exercises: Exercise[]
  sessions: Session[]
  sets: WorkoutSet[]
  programWeeks?: ProgramWeek[]
}

/** IDs 1–6 belonged to the original seed; current templates always have slugs. */
export const isLegacySplitDay = (day: Day): boolean =>
  !day.slug && day.id >= 1 && day.id <= 6

export function withoutLegacySplit<T extends SplitData>(data: T, now: number): T {
  const dayIds = new Set(data.days.filter(isLegacySplitDay).map((day) => day.id))
  const exerciseIds = new Set(data.exercises.filter((exercise) => dayIds.has(exercise.dayId)).map((exercise) => exercise.id))
  const sessionIds = new Set(data.sessions.filter((session) => dayIds.has(session.dayId)).map((session) => session.id))
  return {
    ...data,
    days: data.days.filter((day) => !dayIds.has(day.id)),
    exercises: data.exercises.filter((exercise) => !exerciseIds.has(exercise.id)),
    sessions: data.sessions.filter((session) => !sessionIds.has(session.id)),
    sets: data.sets.filter((set) => !sessionIds.has(set.sessionId) && !exerciseIds.has(set.exerciseId)),
    ...(data.programWeeks ? {
      programWeeks: data.programWeeks.map((week) =>
        week.slots.some((slot) => slot.liftDayId != null && dayIds.has(slot.liftDayId))
          ? { ...week, updatedAt: now, slots: week.slots.map((slot) =>
            slot.liftDayId != null && dayIds.has(slot.liftDayId) ? { ...slot, liftDayId: null } : slot) }
          : week),
    } : {}),
  }
}
