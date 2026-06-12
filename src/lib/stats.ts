import {
  addDays,
  endOfMonth,
  format,
  getISODay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns'
import { dateKey, relativeWhen } from './format'
import type { Day, PR, Session } from '@/db/types'

const finished = (s: Session) => s.finishedAt != null && !s.deleted

/** Sum of session volume over the trailing 7 days (inclusive of today). */
export function volumeLast7Days(sessions: Session[], now = new Date()): number {
  const since = dateKey(subDays(now, 6))
  const today = dateKey(now)
  return sessions
    .filter((s) => finished(s) && s.date >= since && s.date <= today)
    .reduce((sum, s) => sum + (s.totalVolume ?? 0), 0)
}

/** Count of sessions logged in the current ISO week (Mon–Sun). */
export function sessionsThisWeek(sessions: Session[], now = new Date()): number {
  const monday = dateKey(startOfWeek(now, { weekStartsOn: 1 }))
  const sunday = dateKey(addDays(startOfWeek(now, { weekStartsOn: 1 }), 6))
  return sessions.filter((s) => finished(s) && s.date >= monday && s.date <= sunday)
    .length
}

/** Number of consecutive weeks (ending this week) with at least one session. */
export function streakWeeks(sessions: Session[], now = new Date()): number {
  const done = new Set(sessions.filter(finished).map((s) => s.date))
  let streak = 0
  for (let w = 0; w < 104; w++) {
    const monday = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 })
    let any = false
    for (let i = 0; i < 7; i++) {
      if (done.has(dateKey(addDays(monday, i)))) {
        any = true
        break
      }
    }
    if (any) streak++
    else if (w > 0) break // allow the current (possibly-just-started) week to be empty
    else if (w === 0) continue
  }
  return streak
}

export type DotState = 'off' | 'on' | 'bright'
export interface HeatmapColumn {
  name: string
  current: boolean // true for the column ending in the current month
  dots: DotState[]
}

/**
 * Three columns (≈one month each) of a Mon→Sun dot grid, 35 dots per column,
 * driven by which dates have sessions. Sundays and empty days read as `off`.
 */
export function heatmapColumns(
  sessions: Session[],
  now = new Date(),
): HeatmapColumn[] {
  const done = new Set(sessions.filter(finished).map((s) => s.date))
  const thisMonday = startOfWeek(now, { weekStartsOn: 1 })
  const firstMonday = subWeeks(thisMonday, 14) // 15 weeks total → 3 × 35 dots
  const cols: HeatmapColumn[] = []
  let onCount = 0

  for (let c = 0; c < 3; c++) {
    const dots: DotState[] = []
    const colStart = addDays(firstMonday, c * 35)
    for (let i = 0; i < 35; i++) {
      const day = addDays(colStart, i)
      const sunday = getISODay(day) === 7
      const future = day > now
      if (!sunday && !future && done.has(dateKey(day))) {
        onCount++
        dots.push(onCount % 9 === 0 ? 'bright' : 'on')
      } else {
        dots.push('off')
      }
    }
    const lastDay = addDays(colStart, 34)
    cols.push({
      name: format(lastDay, 'MMM'),
      current: isSameMonth(lastDay, now),
      dots,
    })
  }
  return cols
}

export interface CalendarCell {
  n: number | null // null = leading blank
  state: 'workout' | 'today' | 'rest' | 'future' | 'empty'
}
export interface CalendarMonth {
  title: string // 'June 2026'
  plannedLabel: string // '26 of 30 planned'
  cells: CalendarCell[]
}

/** Current-month calendar, Mon-first, with dates aligned under the weekday row. */
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
  for (let i = 0; i < lead; i++) cells.push({ n: null, state: 'empty' })

  let plannedDone = 0
  let plannedTotal = 0
  for (let day = new Date(first); day <= last; day = addDays(day, 1)) {
    const k = dateKey(day)
    const wd = getISODay(day)
    const isToday = k === todayKey
    const isFuture = day > now
    const isRest = wd === 7
    if (!isRest) plannedTotal++
    let state: CalendarCell['state']
    if (isToday) state = 'today'
    else if (done.has(k)) {
      state = 'workout'
      plannedDone++
    } else if (isRest) state = 'rest'
    else if (isFuture) state = 'future'
    else state = 'rest' // a past non-rest day with no session reads as a plain dot
    cells.push({ n: day.getDate(), state })
  }

  return {
    title: format(now, 'MMMM yyyy'),
    plannedLabel: `${plannedDone} of ${plannedTotal} planned`,
    cells,
  }
}

export interface RecentSession {
  id: string
  name: string
  when: string
  vol: string
}

export function recentSessions(
  sessions: Session[],
  days: Day[],
  now = new Date(),
  n = 6,
): RecentSession[] {
  const dayName = (id: number) => days.find((d) => d.id === id)?.name ?? 'Workout'
  return sessions
    .filter(finished)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, n)
    .map((s) => ({
      id: s.id,
      name: dayName(s.dayId),
      when: `${relativeWhen(s.date, now)} · ${Math.round((s.durationSec ?? 0) / 60)} min`,
      vol: `${Math.round(s.totalVolume ?? 0).toLocaleString('en-US')} lb`,
    }))
}

export interface WeeklyBar {
  total: number
  isCurrent: boolean
}

/** Trailing `weeks` of weekly volume totals; the last entry is the current week. */
export function weeklyVolume(
  sessions: Session[],
  now = new Date(),
  weeks = 8,
): WeeklyBar[] {
  const bars: WeeklyBar[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 })
    const sunday = addDays(monday, 6)
    const total = sessions
      .filter(
        (s) =>
          finished(s) &&
          s.date >= dateKey(monday) &&
          s.date <= dateKey(sunday),
      )
      .reduce((sum, s) => sum + (s.totalVolume ?? 0), 0)
    bars.push({ total, isCurrent: w === 0 })
  }
  return bars
}

export interface BodyWeightStats {
  latest: number
  deltaThisMonth: number // signed; negative = lost weight
  polyline: string // points for an SVG viewBox 0 0 320 56
  lastPoint: { x: number; y: number }
  monthLabels: string[]
}

export function bodyWeightStats(
  series: { date: string; lbs: number }[],
): BodyWeightStats | null {
  if (!series.length) return null
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
  const last12 = sorted.slice(-12)
  const values = last12.map((p) => p.lbs)
  const latest = values[values.length - 1]
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1

  // trend over the trailing ~4 readings (≈ a month of weekly weigh-ins)
  const monthAgo = values[Math.max(0, values.length - 5)]

  const W = 320
  const H = 56
  const PAD = 8
  const pts = last12.map((p, i) => {
    const x = last12.length === 1 ? 0 : (i / (last12.length - 1)) * (W - 1)
    const y = PAD + ((max - p.lbs) / span) * (H - 2 * PAD)
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  })

  const monthLabels = uniqueMonths(last12.map((p) => p.date))

  return {
    latest,
    deltaThisMonth: Math.round((latest - monthAgo) * 10) / 10,
    polyline: pts.map((p) => `${p.x},${p.y}`).join(' '),
    lastPoint: pts[pts.length - 1],
    monthLabels,
  }
}

function uniqueMonths(dates: string[]): string[] {
  const seen: string[] = []
  for (const d of dates) {
    const label = format(new Date(d), 'MMM')
    if (!seen.includes(label)) seen.push(label)
  }
  return seen.slice(-4)
}

export function latestPR(prs: PR[]): PR | undefined {
  return [...prs].sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function recentPRs(prs: PR[], n = 4): PR[] {
  return [...prs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n)
}
