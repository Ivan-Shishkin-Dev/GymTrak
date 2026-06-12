import type { Day, Session } from '@/db/types'

/**
 * The ULULUL rotation is a fixed 6-day cycle (Upper A → Lower C). It advances
 * by completion — the next workout is the one after your most recently logged
 * session — so it never depends on the calendar weekday.
 */

const finished = (s: Session) => s.finishedAt != null && !s.deleted

/** The next workout in the cycle given logged sessions. Defaults to Day 1. */
export function nextInCycle(days: Day[], sessions: Session[]): Day | null {
  if (!days.length) return null
  const ordered = [...days].sort((a, b) => a.id - b.id)
  const done = sessions.filter(finished)
  if (!done.length) return ordered[0]
  const last = done.reduce((a, b) => (b.startedAt > a.startedAt ? b : a))
  const idx = ordered.findIndex((d) => d.id === last.dayId)
  if (idx === -1) return ordered[0]
  return ordered[(idx + 1) % ordered.length]
}

/** "DAY 5 OF 6" micro label for the hero — position in the 6-day cycle. */
export function dayOfRotationLabel(day: Day): string {
  return `DAY ${day.id} OF 6`
}

/** "Dip · Pulldown · Press · Low row +3" — first 4 exercise short names + overflow. */
export function exercisePreview(names: string[]): string {
  const short = names.map((n) => n.split(' ')[0])
  if (short.length <= 4) return short.join(' · ')
  return `${short.slice(0, 4).join(' · ')} +${short.length - 4}`
}
