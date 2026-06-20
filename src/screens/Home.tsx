import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/db'
import { startSession } from '@/lib/actions'
import { dayOfRotationLabel, nextInCycle } from '@/lib/rotation'
import { ExerciseSummary } from '@/components/ExerciseSummary'
import { ProgressRing } from '@/components/ProgressRing'
import { SyncBar } from '@/components/SyncBar'
import type { Exercise } from '@/db/types'

export function Home() {
  const navigate = useNavigate()
  const [overrideId, setOverrideId] = useState<number | null>(null)

  const days = useLiveQuery(() => db.days.orderBy('id').toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])

  const autoPicked = nextInCycle(days, sessions)
  const day =
    overrideId != null
      ? (days.find((d) => d.id === overrideId) ?? autoPicked)
      : autoPicked

  const exercises = useLiveQuery(
    async () => {
      if (!day) return [] as Exercise[]
      return db.exercises.where('dayId').equals(day.id).sortBy('order')
    },
    [day?.id],
    [] as Exercise[],
  )

  // Position in the rotation (1-based), works with any number of days.
  const dayPos = day ? days.findIndex((d) => d.id === day.id) + 1 : 0
  const ringPct = day && days.length ? Math.round((dayPos / days.length) * 100) : 0

  async function start() {
    if (!day) return
    const ex = await db.exercises.where('dayId').equals(day.id).sortBy('order')
    await startSession(day, ex)
    navigate('/log')
  }

  return (
    <div className="screen">
      <div className="screen-title">Workouts</div>

      <SyncBar />

      {/* ── Day picker ─────────────────────────────────────────────────── */}
      {days.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 4,
          }}
        >
          {days.map((d, i) => {
            const isSelected =
              overrideId != null ? d.id === overrideId : d.id === autoPicked?.id
            return (
              <button
                key={d.id}
                className="tap"
                onClick={() => setOverrideId(d.id === autoPicked?.id ? null : d.id)}
                style={{
                  height: 34,
                  minWidth: 34,
                  paddingInline: 12,
                  borderRadius: 17,
                  border: isSelected
                    ? '1px solid var(--color-volt)'
                    : '1px solid var(--color-pill-border)',
                  background: isSelected ? 'var(--color-volt-tint)' : 'transparent',
                  color: isSelected ? 'var(--color-volt)' : 'var(--color-sub)',
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em',
                  transition: 'all 0.15s ease',
                }}
              >
                {i + 1}
              </button>
            )
          })}
          <span
            style={{
              alignSelf: 'center',
              fontSize: 11,
              color: 'var(--color-dim)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              marginLeft: 2,
            }}
          >
            PICK DAY
          </span>
        </div>
      )}

      {/* ── Hero card ──────────────────────────────────────────────────── */}
      {day && (
        <div
          className="card"
          style={{
            borderRadius: 30,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.12em',
              color: 'var(--color-sub)',
            }}
          >
            {dayOfRotationLabel(day, days)}
          </div>

          {/* name + ring row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
            <ProgressRing pct={ringPct}>
              <span style={{ fontSize: 22, fontWeight: 680 }}>{dayPos}</span>
            </ProgressRing>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div
                style={{
                  fontSize: 27,
                  fontWeight: 740,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text)',
                  lineHeight: 1.1,
                }}
              >
                {day.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-sub)' }}>
                {day.focus}
              </div>
            </div>
          </div>

          {/* bulleted exercise list */}
          {exercises.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {exercises.map((ex) => (
                <li
                  key={ex.id}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--color-volt)',
                      flexShrink: 0,
                      marginTop: 2,
                      alignSelf: 'center',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--color-text)',
                      lineHeight: 1.35,
                    }}
                  >
                    {ex.name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--color-dim)',
                      fontFamily: 'var(--font-mono)',
                      marginLeft: 'auto',
                      flexShrink: 0,
                    }}
                  >
                    <ExerciseSummary ex={ex} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={start}
            aria-label="Start workout"
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
              cursor: 'pointer',
            }}
          >
            Start workout
          </button>
        </div>
      )}
    </div>
  )
}
