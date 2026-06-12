import { useCallback, useEffect, useState } from 'react'

const KEY = 'gymtrak.restEndsAt'
export const REST_SEC = 90

/**
 * A rest countdown that survives reloads and stays correct in the background by
 * persisting an end-timestamp (not a tick counter), per the README.
 */
export function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(() => {
    const v = localStorage.getItem(KEY)
    return v ? Number(v) : null
  })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (endsAt == null) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [endsAt])

  const remainingSec =
    endsAt != null ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0
  const active = endsAt != null && remainingSec > 0

  useEffect(() => {
    if (endsAt != null && remainingSec <= 0) {
      localStorage.removeItem(KEY)
      setEndsAt(null)
    }
  }, [endsAt, remainingSec])

  const start = useCallback((sec: number = REST_SEC) => {
    const e = Date.now() + sec * 1000
    localStorage.setItem(KEY, String(e))
    setEndsAt(e)
    setNow(Date.now())
  }, [])

  const skip = useCallback(() => {
    localStorage.removeItem(KEY)
    setEndsAt(null)
  }, [])

  const pct = active ? Math.round((remainingSec / REST_SEC) * 100) : 0
  return { active, remainingSec, pct, start, skip }
}
