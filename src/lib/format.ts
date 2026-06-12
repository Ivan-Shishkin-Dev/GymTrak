import { differenceInCalendarDays, format, parseISO } from 'date-fns'

/** Seconds → "m:ss" (used by the elapsed + rest timers). */
export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

/** 61420 → "61,420 lb" */
export function fmtVolume(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} lb`
}

/** 61420 → "61.4k", 980 → "980" (the compact Home stat) */
export function fmtVolumeCompact(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`
  }
  return String(Math.round(n))
}

/** Local 'yyyy-MM-dd' key for a Date. */
export function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** Friendly relative label for a session date: Today / Yesterday / Wed / Sat Jun 6. */
export function relativeWhen(isoDate: string, now = new Date()): string {
  const d = parseISO(isoDate)
  const diff = differenceInCalendarDays(now, d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return format(d, 'EEE') // Wed
  return format(d, 'EEE MMM d') // Sat Jun 6
}

/** Short month-day, e.g. "Jun 8". Parses as local (avoids the UTC off-by-one). */
export function shortDate(isoDate: string): string {
  return format(parseISO(isoDate), 'MMM d')
}

/** Short weekday for a local date key, e.g. "Tue". */
export function weekdayShort(isoDate: string): string {
  return format(parseISO(isoDate), 'EEE')
}

/**
 * Parse a load token into a number for volume math.
 * Returns null for non-numeric machine loads ('Max', 'BW', 'heavy', '6 pl'…),
 * which are excluded from volume (owner's call — see README "Volume math").
 */
export function parseLoad(token: string): number | null {
  const cleaned = token.replace(/lb|lbs/gi, '').trim()
  // bail on anything that isn't a plain (optionally signed) number
  const m = cleaned.match(/^[+]?(\d+(?:\.\d+)?)$/)
  return m ? Number(m[1]) : null
}

/** Parse a rep token ('× 6', '6', '8–12') → leading integer or null. */
export function parseReps(token: string): number | null {
  const m = token.match(/(\d+)/)
  return m ? Number(m[1]) : null
}
