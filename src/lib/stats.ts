import { addDays, endOfMonth, format, getISODay, startOfMonth } from 'date-fns'
import { dateKey } from './format'
import type { Session } from '@/db/types'

const finished = (s: Session) => s.finishedAt != null && !s.deleted

export interface CalendarCell {
  n: number | null // null = leading blank
  key: string | null // local 'yyyy-MM-dd' for this cell (null for blanks)
  state: 'workout' | 'today' | 'future' | 'idle' | 'empty'
}
export interface CalendarMonth {
  title: string // 'June 2026'
  plannedLabel: string // '12 workouts'
  cells: CalendarCell[]
}

/**
 * Current-month calendar, Mon-first, with dates aligned under the weekday row.
 * A day is a `workout` if a finished session landed on it; the rotation no longer
 * cares about weekdays, so there's no "rest day" — empty past days are just idle.
 */
export function calendarMonth(
  sessions: Session[],
  now = new Date(),
): CalendarMonth {
  const done = new Set(sessions.filter(finished).map((s) => s.date))
  const first = startOfMonth(now)
  const last = endOfMonth(now)
  const lead = getISODay(first) - 1 // Mon=0 leading blanks
  const todayKey = dateKey(now)

  const cells: CalendarCell[] = []
  for (let i = 0; i < lead; i++) cells.push({ n: null, key: null, state: 'empty' })

  let plannedDone = 0
  for (let day = new Date(first); day <= last; day = addDays(day, 1)) {
    const k = dateKey(day)
    const isToday = k === todayKey
    const isFuture = day > now
    let state: CalendarCell['state']
    if (done.has(k)) {
      state = 'workout'
      plannedDone++
    } else if (isToday) state = 'today'
    else if (isFuture) state = 'future'
    else state = 'idle'
    cells.push({ n: day.getDate(), key: k, state })
  }

  return {
    title: format(now, 'MMMM yyyy'),
    plannedLabel: `${plannedDone} ${plannedDone === 1 ? 'workout' : 'workouts'}`,
    cells,
  }
}

/** The finished session logged on a given local date key, if any. */
export function sessionOnDate(sessions: Session[], key: string): Session | null {
  return sessions.find((s) => finished(s) && s.date === key) ?? null
}
