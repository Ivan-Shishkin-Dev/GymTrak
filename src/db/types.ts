import { z } from 'zod'

/**
 * Zod schemas are the single source of truth for record shapes.
 * Types are inferred from them, and the same schemas can be reused to validate
 * Supabase sync payloads in phase 2.
 *
 * Sync-readiness (see README): every record carries a string UUID `id` and an
 * `updatedAt` epoch-ms stamp; deletions are soft (`deleted: true`) where it
 * matters, so a future last-write-wins sync is a bolt-on, not a rewrite.
 */

/** One of the 6 rotation days in the ULULUL split. `id` doubles as rotation order (1..6). */
export const DaySchema = z.object({
  id: z.number().int(), // 1..6 — also the rotation order
  name: z.string(), // 'Upper C'
  focus: z.string(), // 'Shoulder lean'
})
export type Day = z.infer<typeof DaySchema>

/** A prescribed exercise belonging to a day, with its carry-over load. */
export const ExerciseSchema = z.object({
  id: z.string(),
  dayId: z.number().int(),
  order: z.number().int(),
  name: z.string(),
  sets: z.number().int(), // default set count
  weight: z.string(), // carry-over load token: '+70 lb' | 'Max' | '75 lb'
  reps: z.string(), // displayed as '× {reps}', e.g. '× 6'
  note: z.string(), // log header note, e.g. '+80 × 6 → +70 × 6'
  libLoad: z.string(), // library prescription tail, e.g. '+70 × 6'
  updatedAt: z.number(),
})
export type Exercise = z.infer<typeof ExerciseSchema>

/** A workout session — one instance of a day, logged on a date. */
export const SessionSchema = z.object({
  id: z.string(),
  dayId: z.number().int(),
  date: z.string(), // local 'yyyy-MM-dd'
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  durationSec: z.number().nullable(),
  updatedAt: z.number(),
  deleted: z.boolean().optional(),
})
export type Session = z.infer<typeof SessionSchema>

/** A single set performed within a session. */
export const WorkoutSetSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  exerciseId: z.string(),
  exerciseName: z.string(),
  setIndex: z.number().int(),
  weight: z.string(), // token, may be 'Max'
  reps: z.string(),
  weightNum: z.number().nullable(), // numeric equivalent for volume; null for 'Max'/bodyweight
  repsNum: z.number().nullable(),
  completedAt: z.number().nullable(),
  comment: z.string().optional(), // free note added after the set, shown in History
  updatedAt: z.number(),
})
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>

/** A free-text note about training — the Home notepad. Newest first. */
export const NoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.number(), // epoch ms
  updatedAt: z.number(),
  deleted: z.boolean().optional(),
})
export type Note = z.infer<typeof NoteSchema>

/** A personal record, logged with the moment it was hit. */
export const PRSchema = z.object({
  id: z.string(),
  lift: z.string(), // 'Bench', 'SLDL', 'Dip'…
  value: z.string(), // free token: '225 × 4', '315 lb', '+90 × 5'
  at: z.number(), // epoch ms — captures both the date and the time
  date: z.string(), // local 'yyyy-MM-dd' (derived from `at`, for indexing/grouping)
  updatedAt: z.number(),
  deleted: z.boolean().optional(),
})
export type PR = z.infer<typeof PRSchema>
