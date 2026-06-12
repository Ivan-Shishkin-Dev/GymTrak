import { getISODay } from 'date-fns'
import type { Day } from '@/db/types'

/**
 * The ULULUL rotation runs Mon–Sat (Upper A → Lower C); Sunday is rest.
 * A day's `weekday` is its ISO weekday (1=Mon … 6=Sat), which also equals its
 * rotation order (1..6), so today's day is found by today's ISO weekday.
 */

export function isRestDay(now = new Date()): boolean {
  return getISODay(now) === 7 // Sunday
}

/** Today's rotation day from the day list, or null on a rest day. */
export function todaysDay(days: Day[], now = new Date()): Day | null {
  const wd = getISODay(now)
  return days.find((d) => d.weekday === wd) ?? null
}

/** The next training day after today (wraps Sun→Mon). */
export function nextDay(days: Day[], now = new Date()): Day | null {
  if (!days.length) return null
  const today = getISODay(now)
  for (let i = 1; i <= 7; i++) {
    const wd = ((today - 1 + i) % 7) + 1
    const d = days.find((x) => x.weekday === wd)
    if (d) return d
  }
  return null
}

/** "FRIDAY — DAY 5 OF 6" micro label for the hero. */
export function dayOfRotationLabel(day: Day, now = new Date()): string {
  const weekday = now
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase()
  return `${weekday} — DAY ${day.weekday} OF 6`
}

/** "Dip · Pulldown · Press · Low row +3" — first 4 exercise short names + overflow. */
export function exercisePreview(names: string[]): string {
  const short = names.map((n) => n.split(' ')[0])
  if (short.length <= 4) return short.join(' · ')
  return `${short.slice(0, 4).join(' · ')} +${short.length - 4}`
}
