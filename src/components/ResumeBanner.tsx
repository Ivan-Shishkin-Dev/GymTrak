import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { db } from '@/db/db'

/**
 * Shown on the tabbed screens whenever a workout is in progress (an open session
 * exists). Tapping it drops you back into `/log` — so you can back out of a live
 * workout, browse the app, and return without losing your place. Renders nothing
 * when there's no open session.
 */
export function ResumeBanner() {
  const navigate = useNavigate()

  const session = useLiveQuery(async () => {
    const open = (await db.sessions.toArray()).filter(
      (s) => s.finishedAt == null && !s.deleted,
    )
    return open[0]
  }, [])

  const counts = useLiveQuery(async () => {
    if (!session) return null
    const sets = await db.sets.where('sessionId').equals(session.id).toArray()
    return { done: sets.filter((s) => s.completedAt != null).length, total: sets.length }
  }, [session?.id])

  const day = useLiveQuery(
    async () => (session ? await db.days.get(session.dayId) : undefined),
    [session?.dayId],
  )

  if (!session) return null

  return (
    <div style={{ flexShrink: 0, padding: '0 20px 8px', background: 'var(--color-bg)' }}>
    <button
      onClick={() => navigate('/log')}
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
          WORKOUT IN PROGRESS
        </div>
        <div style={{ fontSize: 15, fontWeight: 660, lineHeight: 1.2 }}>
          {day?.name ?? 'Resume'}
          {counts ? (
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
