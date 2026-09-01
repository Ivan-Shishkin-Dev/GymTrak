import { addDays, startOfWeek } from 'date-fns'
import { dateKey } from './format'
import type { Dow, ProgramSlot, ProgramWeek, RunPrescription } from '@/db/types'

/**
 * Program helpers — pure, no Dexie. The week is the unit that knows the calendar:
 * each `ProgramWeek` stores the local date of its own Monday, so locating "this
 * week" is a string comparison rather than week arithmetic. No DST drift, no
 * timezone math, no off-by-one at year boundaries.
 */

/** Monday-first, matching how the program weeks are laid out. */
export const DOWS: readonly Dow[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const DOW_LABEL: Record<Dow, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

/** Full weekday name for the hero eyebrow. */
export const dowLabel = (d: Dow): string => DOW_LABEL[d]

/** Local weekday of a date. JS weeks start Sunday; the program starts Monday. */
export const dowOf = (d: Date): Dow => DOWS[(d.getDay() + 6) % 7]

/** The 'yyyy-MM-dd' of the Monday of whatever week `d` falls in. */
export const mondayKey = (d: Date): string =>
  dateKey(startOfWeek(d, { weekStartsOn: 1 }))

/**
 * The program week containing `d`, or null when the date falls outside the phase
 * (before it starts, after it ends, or in a gap). Null is a real state the UI
 * renders explicitly — better than silently showing the nearest week.
 */
export function weekFor(weeks: ProgramWeek[], d: Date): ProgramWeek | null {
  const key = mondayKey(d)
  return weeks.find((w) => w.startDate === key) ?? null
}

export const slotOf = (w: ProgramWeek, dow: Dow): ProgramSlot | undefined =>
  w.slots.find((s) => s.dow === dow)

/** Local date of one slot within its week. */
export const slotDate = (w: ProgramWeek, dow: Dow): string =>
  dateKey(addDays(new Date(`${w.startDate}T00:00:00`), DOWS.indexOf(dow)))

/** A slot with neither a lift nor a run is a rest day. */
export const isRest = (s: ProgramSlot | undefined): boolean =>
  s == null || (s.liftDayId == null && s.run == null)

/** 'BASE 1' from 'base-1', for the Home eyebrow. */
export const phaseLabel = (phase: string): string =>
  phase.replace(/-/g, ' ').toUpperCase()

/** '120–140' — the zone as written everywhere it's shown. */
export const zoneLabel = (min: number, max: number): string => `${min}–${max}`

/* ── Saying what a day asks for ───────────────────────────────────────────── */

/** 'Long Run' → 'long run', so a label reads as prose mid-sentence. */
const lower = (label: string): string => label.toLowerCase()

/**
 * One day in plain words: 'Rest' · 'Upper A' · '30 min easy run' ·
 * 'Upper A · 25 min run'.
 *
 * Every surface that lists days goes through this, so the week list, the day
 * card and the Library can never describe the same day two different ways.
 */
export function slotSummary(
  slot: ProgramSlot | undefined,
  dayName: string | null,
): string {
  if (isRest(slot)) return 'Rest'
  const run = slot?.run
  if (dayName && run) return `${dayName} · ${run.durationMin} min run`
  if (dayName) return dayName
  if (run) return `${run.durationMin} min ${lower(run.label)}`
  return 'Rest'
}

/** '25 min easy run · Zone 2' — the run sub-line. The bpm range, hard cap, pace
 *  and strides copy deliberately stay on the run screen, where they get read. */
export const runLine = (run: RunPrescription): string =>
  `${run.durationMin} min ${lower(run.label)} · Zone 2`

/* ── Pace ─────────────────────────────────────────────────────────────────── */

/**
 * The measured Zone 2 pace: 2.5 mi in 30 min → 12:00 /mi.
 *
 * The plan stays prescribed in MINUTES, deliberately. That is the point of a
 * Zone 2 block — the effort is capped by heart rate, and as aerobic fitness
 * improves the same 140 bpm buys more distance for free. A distance target would
 * quietly turn an easy run into a hard one on a bad day. So pace is used for
 * DISPLAY only: it says what each prescription works out to on the ground.
 *
 * Edit the reference below when a run says otherwise and every mileage figure in
 * the app moves with it.
 */
export const ZONE2_REFERENCE = { miles: 2.5, minutes: 30 } as const

/** Minutes per mile at Zone 2 — 12.0. */
export const ZONE2_PACE = ZONE2_REFERENCE.minutes / ZONE2_REFERENCE.miles

/** Miles covered in `min` minutes at Zone 2 pace. */
export const milesFor = (min: number): number => min / ZONE2_PACE

/** '2.5 mi' — what a duration works out to. Always shown as an approximation. */
export const milesLabel = (min: number): string => `${milesFor(min).toFixed(1)} mi`

/** '12:00 /mi' from decimal minutes per mile. */
export function paceLabel(minPerMi: number = ZONE2_PACE): string {
  const secs = Math.round(minPerMi * 60)
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} /mi`
}

/** Pace actually run, or null when either half of the measurement is missing. */
export function pacePerMile(min: number | null, miles: number | null): number | null {
  if (min == null || miles == null || !(min > 0) || !(miles > 0)) return null
  return min / miles
}

/** Total prescribed run minutes across a week. */
export const weekMinutes = (w: ProgramWeek): number =>
  w.slots.reduce((t, s) => t + (s.run?.durationMin ?? 0), 0)

/** Appended to a run's detail view when the prescription calls for strides. */
export const STRIDES_NOTE = [
  '4 x 20 sec strides at the end, full walk recovery between each.',
  'Relaxed and fast, not sprints.',
] as const

export const DELOAD_NOTE = 'Deload week. Reduced volume is intentional.'
