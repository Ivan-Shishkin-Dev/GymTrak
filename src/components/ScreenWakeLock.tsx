import { useEffect, useRef } from 'react'
import { useRestTimer } from '@/lib/restTimer'

/**
 * Holds a screen wake lock while a rest is running, so the phone doesn't dim or
 * lock between sets and the docked countdown stays glanceable on the bench.
 *
 * Best-effort: the Wake Lock API is absent on older iOS / non-HTTPS (we no-op
 * there), and the browser auto-releases the lock whenever the page is hidden
 * (you manually lock, switch apps, etc.) — so we re-acquire on `visibilitychange`
 * while still resting. The lock drops the moment the rest ends (Skip / Finish /
 * overrun auto-stop) or this unmounts. Rendered once at the app root; draws nothing.
 */
export function ScreenWakeLock() {
  const { active } = useRestTimer()
  const sentinel = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let cancelled = false

    const acquire = async () => {
      // A hidden page can't hold a lock; only request while visible and unheld.
      if (cancelled || sentinel.current || document.visibilityState !== 'visible') return
      try {
        const s = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void s.release().catch(() => {})
          return
        }
        sentinel.current = s
        // Browser releases on hide → drop our ref so visibilitychange re-acquires.
        s.addEventListener('release', () => {
          if (sentinel.current === s) sentinel.current = null
        })
      } catch {
        /* denied / low battery / unsupported — best-effort, ignore */
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      const held = sentinel.current
      sentinel.current = null
      if (held) void held.release().catch(() => {})
    }
  }, [active])

  return null
}
