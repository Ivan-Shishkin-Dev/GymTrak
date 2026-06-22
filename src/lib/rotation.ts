import type { Day, Session } from '@/db/types'

/**
 * Rotation helpers. The split is a cycle of any length (the default seed is the
 * 6-day ULULUL split, Upper A → Lower C, but days can be added/removed/reordered).
 * `nextInCycle` is only a SUGGESTION — the day after your most recently finished
 * one — surfaced as a hint on Home. Nothing forces you onto it; you can start any
 * day. It never depends on the calendar weekday.
 */

const finished = (s: Session) => s.finishedAt != null && !s.deleted

/**
 * Rotation position of a day. `id` is a stable key; `order` is the editable
 * rotation slot. Older records (and the seed) have no `order`, so we fall back to
 * `id` — which preserves the original 1..6 ordering until days are reordered.
 */
export const dayRank = (d: Day): number => d.order ?? d.id
/** Sort comparator for rotation order. */
export const byDayOrder = (a: Day, b: Day): number => dayRank(a) - dayRank(b)

/** Suggested next day: the one after your most recent finished session. Defaults to Day 1. */
export function nextInCycle(days: Day[], sessions: Session[]): Day | null {
  if (!days.length) return null
  const ordered = [...days].sort(byDayOrder)
  const done = sessions.filter(finished)
  if (!done.length) return ordered[0]
  const last = done.reduce((a, b) => (b.startedAt > a.startedAt ? b : a))
  const idx = ordered.findIndex((d) => d.id === last.dayId)
  if (idx === -1) return ordered[0]
  return ordered[(idx + 1) % ordered.length]
}

/** "DAY 5 OF 6" micro label for the hero — position in the rotation (any length). */
export function dayOfRotationLabel(day: Day, days: Day[]): string {
  const ordered = [...days].sort(byDayOrder)
  const pos = ordered.findIndex((d) => d.id === day.id) + 1
  return `DAY ${pos || 1} OF ${ordered.length || 1}`
}

/**
 * Compact rail monogram for a rotation day: type initial + variant ("Upper A" →
 * "UA", "Lower B" → "LB"). Falls back to the name's initials, then the position,
 * so a custom-named day still gets a legible 1–2 char tag.
 */
export function dayMonogram(name: string, pos: number): string {
  const m = /^(upper|lower)\s+(\S+)/i.exec(name.trim())
  if (m) return (m[1][0] + m[2][0]).toUpperCase()
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return initials || String(pos)
}
