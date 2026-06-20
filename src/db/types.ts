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

/** One planned set's load — lets sets differ (e.g. a top set + back-offs). */
export const SetRowSchema = z.object({
  weight: z.string(), // load token: '+70 lb' | 'Max' | '225 lb'
  reps: z.string(), // displayed as '× {reps}', e.g. '× 6'
})
export type SetRow = z.infer<typeof SetRowSchema>

/**
 * How an exercise's load is entered — the "kind" of weight, pinned per exercise
 * so the notation can't drift set-to-set:
 *   weight     — free-weight pounds (bench, dumbbells)        → "225 lb"
 *   machine    — selectorized pin reading, or Max (+ extra)   → "10", "Max + 10"
 *   plates     — plate count (+ extra lb)                     → "6 pl", "5 pl + 25"
 *   bodyweight — bodyweight, optionally weighted/assisted     → "BW", "+70"
 *   free       — anything else, verbatim                      → "wtd", "heavy"
 * The grammar that parses/formats each lives in src/lib/load.ts.
 */
export const LoadTypeSchema = z.enum([
  'weight',
  'machine',
  'plates',
  'bodyweight',
  'free',
])
export type LoadType = z.infer<typeof LoadTypeSchema>

/** A prescribed exercise belonging to a day, with its carry-over load. */
export const ExerciseSchema = z.object({
  id: z.string(),
  dayId: z.number().int(),
  order: z.number().int(),
  name: z.string(),
  sets: z.number().int(), // set count (kept in sync with setRows.length)
  weight: z.string(), // first set's load — fallback when setRows is absent
  reps: z.string(), // first set's reps — fallback when setRows is absent
  note: z.string(), // log header note, e.g. '+80 × 6 → +70 × 6'
  libLoad: z.string(), // free-text description shown on the card, e.g. 'Heavy 3–4, top set + back-off'
  setRows: z.array(SetRowSchema).optional(), // per-set loads; falls back to sets×weight/reps when absent
  loadType: LoadTypeSchema.optional(), // how `weight` is entered; inferred from the string when absent
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
  updatedAt: z.number(),
})
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>
