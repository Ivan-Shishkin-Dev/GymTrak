import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { db } from '@/db/db'
import { fmtClock } from '@/lib/format'
import { hasLiftDay, isRun, sessionRoute, sessionTitle } from '@/lib/session'

/**
 * Shown on the tabbed screens whenever a session is in progress. Tapping it drops
 * you back into the right screen — `/log` for a lift, `/run` for a run — so you
 * can back out mid-session, browse the app, and return without losing your place.
 * Renders nothing when there's no open session.
 */
export function ResumeBanner() {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())

  const session = useLiveQuery(async () => {
    const open = (await db.sessions.toArray()).filter(
      (s) => s.finishedAt == null && !s.deleted,
    )
    return open[0]
  }, [])

  const running = session != null && isRun(session)

  const counts = useLiveQuery(async () => {
    if (!session || isRun(session)) return null
    const sets = await db.sets.where('sessionId').equals(session.id).toArray()
    return { done: sets.filter((s) => s.completedAt != null).length, total: sets.length }
  }, [session?.id])

  // A run has no lift day — db.days.get(RUN_DAY_ID) would just return undefined.
  const day = useLiveQuery(
    async () =>
      session && hasLiftDay(session) ? await db.days.get(session.dayId) : undefined,
    [session?.dayId],
  )

  // Runs show a live clock instead of a set count, so they need a tick.
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])

  if (!session) return null

  return (
    <div style={{ flexShrink: 0, padding: '0 20px 8px', background: 'var(--color-bg)' }}>
    <button
      onClick={() => navigate(sessionRoute(session))}
      className="tap press"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 18,
        border: '1px solid var(--color-volt)',
        background: 'var(--color-volt-tint)',
        color: 'var(--color-text)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'var(--color-volt)',
          color: 'var(--color-on-volt)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Play size={15} strokeWidth={2.5} fill="currentColor" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-volt)', letterSpacing: '0.04em' }}>
          {running ? 'RUN IN PROGRESS' : 'WORKOUT IN PROGRESS'}
        </div>
        <div style={{ fontSize: 15, fontWeight: 660, lineHeight: 1.2 }}>
          {sessionTitle(session, day?.name)}
          {running ? (
            <span style={{ color: 'var(--color-sub)', fontWeight: 500 }}>
              {' '}· {fmtClock(Math.floor((now - session.startedAt) / 1000))}
            </span>
          ) : counts ? (
            <span style={{ color: 'var(--color-sub)', fontWeight: 500 }}>
              {' '}· {counts.done}/{counts.total} sets
            </span>
          ) : null}
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 660, color: 'var(--color-volt)', flexShrink: 0 }}>
        Resume
      </span>
    </button>
    </div>
  )
}
