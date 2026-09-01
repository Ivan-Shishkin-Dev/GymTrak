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
  id: z.number().int(), // stable primary key (referenced by sessions/exercises)
  order: z.number().int().optional(), // rotation position; falls back to `id` when absent
  name: z.string(), // 'Upper C'
  focus: z.string(), // 'Shoulder lean'
  slug: z.string().optional(), // 'upper-a' — stable identity for the program installer.
  // Matching on `name` would break the moment a day is renamed, so the installer
  // keys off this instead. Absent on the six legacy seed days, which is what makes
  // "archive everything without a slug" a safe, idempotent one-shot.
  archived: z.boolean().optional(), // hidden from the Library; past sessions still resolve
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
  note: z.string().optional(), // legacy free-text cue — no UI writes it anymore; kept for old snapshots
  libLoad: z.string().optional(), // legacy "Description" — no UI writes it anymore; kept for old snapshots
  setRows: z.array(SetRowSchema).optional(), // per-set loads; falls back to sets×weight/reps when absent
  loadType: LoadTypeSchema.optional(), // how `weight` is entered; inferred from the string when absent
  updatedAt: z.number(),
})
export type Exercise = z.infer<typeof ExerciseSchema>

/* ── The running program ──────────────────────────────────────────────────────
 * A phase (Base, Build, Half-specific…) is just a run of `ProgramWeek` rows. The
 * week is the unit that knows the calendar; everything else hangs off it.
 *
 * Two shapes that look alike but must not be merged:
 *   RunPrescription — what the plan SAYS to run. Lives in a week's slot.
 *   RunLog          — what you ACTUALLY ran. Lives on the session, and snapshots
 *                     its prescription so history stays truthful if the program is
 *                     later edited or re-anchored to different dates.
 */

export const DowSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
export type Dow = z.infer<typeof DowSchema>

export const RunLabelSchema = z.enum(['Easy Run', 'Long Run'])
export type RunLabel = z.infer<typeof RunLabelSchema>

/** Whether the run hangs off a lift or stands on its own. */
export const RunTimingSchema = z.enum(['after-lift', 'standalone'])
export type RunTiming = z.infer<typeof RunTimingSchema>

/** A PLANNED run attached to one weekday slot. Not a record — it has no id: a
 *  prescription is uniquely determined by (week, dow) and is never shared. */
export const RunPrescriptionSchema = z.object({
  label: RunLabelSchema,
  timing: RunTimingSchema,
  durationMin: z.number().int(),
  hrZoneMin: z.number().int(), // bpm
  hrZoneMax: z.number().int(), // bpm
  hrHardCap: z.number().int(), // bpm — logging above this flags the session
  strides: z.boolean(),
  notes: z.string().nullable(),
})
export type RunPrescription = z.infer<typeof RunPrescriptionSchema>

/** One weekday of a program week. Both null ⇒ a rest day (rest is the absence of
 *  a prescription, which is why it isn't a SessionType). */
export const ProgramSlotSchema = z.object({
  dow: DowSchema,
  liftDayId: z.number().int().nullable(), // → days.id
  run: RunPrescriptionSchema.nullable(),
})
export type ProgramSlot = z.infer<typeof ProgramSlotSchema>

/**
 * One week of the program. `id` IS the global week number (9..16 for Base), which
 * makes seeding an idempotent `bulkPut` — a re-run physically cannot duplicate a
 * week. `phase` is a plain string, not an enum, so weeks 1–8 and 17–28 can be
 * added later without a type edit or a snapshot break.
 */
export const ProgramWeekSchema = z.object({
  id: z.number().int(), // = week number
  phase: z.string(), // 'base-1' | 'base-2' | …
  startDate: z.string(), // local 'yyyy-MM-dd' of this week's MONDAY
  isDeload: z.boolean(),
  slots: z.array(ProgramSlotSchema), // exactly 7, mon→sun
  updatedAt: z.number(), // required: sync's localMaxUpdatedAt scans it to win pull races
})
export type ProgramWeek = z.infer<typeof ProgramWeekSchema>

/** What kind of thing a session is. Rest isn't here — you never log a rest day. */
export const SessionTypeSchema = z.enum(['lift', 'run'])
export type SessionType = z.infer<typeof SessionTypeSchema>

/** A PERFORMED run, embedded in its session. */
export const RunLogSchema = z.object({
  label: RunLabelSchema,
  dow: DowSchema,
  plannedMin: z.number().int(),
  hrZoneMin: z.number().int(),
  hrZoneMax: z.number().int(),
  hrHardCap: z.number().int(),
  strides: z.boolean(),
  actualMin: z.number().nullable(), // null until finished
  actualMi: z.number().nullable(), // measured distance; keeps ZONE2_REFERENCE honest
  avgHr: z.number().nullable(), // null when you didn't record it — never required
  notes: z.string().nullable(),
})
export type RunLog = z.infer<typeof RunLogSchema>

/**
 * Reserved `days.id` for sessions that aren't a lift day. `addDay()` allocates
 * from max(id)+1 and the seed starts at 1, so 0 is never a real day. This keeps
 * `Session.dayId` a required number — making it nullable would touch ~28 call
 * sites and every older snapshot reader. Do not "fix" this to null.
 */
export const RUN_DAY_ID = 0

/** A workout session — one instance of a day, logged on a date. */
export const SessionSchema = z.object({
  id: z.string(),
  dayId: z.number().int(), // RUN_DAY_ID (0) for runs — see the constant below
  date: z.string(), // local 'yyyy-MM-dd'
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  durationSec: z.number().nullable(),
  updatedAt: z.number(),
  deleted: z.boolean().optional(),
  // ── Program fields. All optional, so every pre-program record stays valid. ──
  type: SessionTypeSchema.optional(), // absent ⇒ 'lift'
  weekNumber: z.number().int().optional(), // → programWeeks.id
  deload: z.boolean().optional(), // this session ran reduced volume
  run: RunLogSchema.optional(), // present iff type === 'run'
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
