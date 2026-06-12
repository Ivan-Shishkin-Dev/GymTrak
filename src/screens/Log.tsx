import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/db'
import { finishSession, toggleSet } from '@/lib/actions'
import { fmtClock } from '@/lib/format'
import { useRestTimer } from '@/hooks/useRestTimer'
import { BackChevron } from '@/components/icons'
import type { Exercise, WorkoutSet } from '@/db/types'

export function Log() {
  const navigate = useNavigate()
  const rest = useRestTimer()
  const [now, setNow] = useState(() => Date.now())

  const open = useLiveQuery(
    () => db.sessions.filter((s) => s.finishedAt == null && !s.deleted).toArray(),
    [],
  )
  const session = open?.[0]

  const sets = useLiveQuery(
    () =>
      session
        ? db.sets.where('sessionId').equals(session.id).toArray()
        : Promise.resolve([] as WorkoutSet[]),
    [session?.id],
    [],
  )
  const exercises = useLiveQuery(
    async () => {
      if (!session) return [] as Exercise[]
      return db.exercises.where('dayId').equals(session.dayId).sortBy('order')
    },
    [session?.dayId],
    [] as Exercise[],
  )
  const day = useLiveQuery(
    async () => (session ? await db.days.get(session.dayId) : undefined),
    [session?.dayId],
  )

  // elapsed timer ticks once a second from the session's start
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // no open session (e.g. opened /log directly or after finishing) → go home
  useEffect(() => {
    if (open !== undefined && open.length === 0) navigate('/', { replace: true })
  }, [open, navigate])

  if (!session || !day) return null

  const groups = exercises
    .map((ex) => ({
      ex,
      sets: sets
        .filter((s) => s.exerciseId === ex.id)
        .sort((a, b) => a.setIndex - b.setIndex),
    }))
    .filter((g) => g.sets.length > 0)

  const done = sets.filter((s) => s.completedAt != null).length
  const total = sets.length
  const elapsed = Math.max(0, Math.floor((now - session.startedAt) / 1000))

  async function onToggle(id: string) {
    const nowDone = await toggleSet(id)
    if (nowDone) rest.start()
  }

  async function onFinish() {
    rest.skip()
    await finishSession(session!.id)
    navigate('/', { replace: true })
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: `calc(70px + env(safe-area-inset-top)) 20px 12px`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate('/')}
          aria-label="Back"
          className="card tap"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            borderColor: 'var(--color-pill-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BackChevron />
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {day.name}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-sub)' }}>
            {day.focus} · {done} of {total} sets
          </div>
        </div>
        <div
          className="card tabular-nums"
          style={{
            fontSize: 16,
            fontWeight: 640,
            borderRadius: 99,
            borderColor: 'var(--color-pill-border)',
            padding: '8px 14px',
          }}
        >
          {fmtClock(elapsed)}
        </div>
      </div>

      {/* Set list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--color-faint)', padding: '0 2px' }}>
          Loads carried over from your last session — tap the circle when a set is done
        </div>

        {groups.map(({ ex, sets: exSets }) => (
          <div
            key={ex.id}
            className="card"
            style={{ borderRadius: 22, padding: '8px 18px 12px' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 0 4px',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 640 }}>{ex.name}</div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--color-sub)',
                  textAlign: 'right',
                }}
              >
                {ex.note}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {exSets.map((st, i) => {
                const isDone = st.completedAt != null
                return (
                  <div
                    key={st.id}
                    onClick={() => onToggle(st.id)}
                    className="tap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      height: 46,
                      opacity: isDone ? 0.45 : 1,
                    }}
                  >
                    <div style={{ width: 42, fontSize: 12, color: 'var(--color-sub)' }}>
                      Set {i + 1}
                    </div>
                    <div
                      className="tabular-nums"
                      style={{ flex: 1, fontSize: 16, fontWeight: 620 }}
                    >
                      {st.weight}
                    </div>
                    <div
                      className="tabular-nums"
                      style={{ fontSize: 14, color: 'var(--color-sub)' }}
                    >
                      {st.reps}
                    </div>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: `1.5px solid ${isDone ? 'var(--color-volt)' : 'var(--color-check-border)'}`,
                        background: isDone ? 'var(--color-volt)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 800,
                        color: isDone ? 'var(--color-on-volt)' : 'transparent',
                      }}
                    >
                      ✓
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--color-card-border)',
          background: 'rgba(10,10,11,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: `14px 20px calc(30px + env(safe-area-inset-bottom))`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {rest.active && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--color-volt)',
              }}
            >
              REST
            </div>
            <div
              className="tabular-nums"
              style={{ fontSize: 16, fontWeight: 700, width: 44 }}
            >
              {fmtClock(rest.remainingSec)}
            </div>
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: 'var(--color-track)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 2,
                  background: 'var(--color-volt)',
                  width: `${rest.pct}%`,
                  transition: 'width 0.25s linear',
                }}
              />
            </div>
            <div
              onClick={rest.skip}
              className="tap"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-sub)',
                padding: '4px 6px',
              }}
            >
              Skip
            </div>
          </div>
        )}

        {done > 0 && (
          <button
            onClick={onFinish}
            className="tap"
            style={{
              height: 52,
              borderRadius: 26,
              background: 'var(--color-volt)',
              color: 'var(--color-on-volt)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              border: 'none',
            }}
          >
            Finish workout
          </button>
        )}
      </div>
    </div>
  )
}
