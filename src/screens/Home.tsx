import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { db } from '@/db/db'
import { startSession } from '@/lib/actions'
import { byDayOrder, dayOfRotationLabel, nextInCycle } from '@/lib/rotation'
import { ExerciseSummary } from '@/components/ExerciseSummary'
import { CycleRail } from '@/components/CycleRail'
import { SyncBar } from '@/components/SyncBar'
import { useEditMode } from '@/lib/sync'
import type { Exercise } from '@/db/types'

/** Volt-tinted hero card surface. */
const HERO_BACKGROUND =
  'radial-gradient(130% 90% at 15% -10%, rgba(205, 244, 99, 0.13), transparent 55%), var(--color-card)'
const HERO_SHADOW =
  '0 0 60px -24px rgba(205, 244, 99, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.05)'

/** Hero-shaped shimmer shown for the blink before the first queries resolve. */
function HeroSkeleton() {
  return (
    <div
      className="card"
      style={{ borderRadius: 30, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div className="skeleton" style={{ width: 90, height: 11, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: '52%', height: 30, borderRadius: 8 }} />
      <div className="skeleton" style={{ width: 88, height: 22, borderRadius: 8 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 6 }}>
        {[82, 70, 76, 62, 68].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: `${w}%`, height: 13, borderRadius: 6 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 52, borderRadius: 26, marginTop: 4 }} />
    </div>
  )
}

export function Home() {
  const navigate = useNavigate()
  const editMode = useEditMode()
  const [overrideId, setOverrideId] = useState<number | null>(null)

  const days = useLiveQuery(async () => (await db.days.toArray()).sort(byDayOrder), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  // undefined = still loading (show skeleton); [] = loaded but empty
  const ready = days !== undefined && sessions !== undefined
  const dayList = days ?? []
  const sessionList = sessions ?? []

  // Soft suggestion only: the day after your most recently finished one. It's the
  // default selection and gets a marker in the rail — but you can start any day.
  const suggested = nextInCycle(dayList, sessionList)
  const day =
    overrideId != null
      ? (dayList.find((d) => d.id === overrideId) ?? suggested)
      : suggested
  const isSuggested = day != null && day.id === suggested?.id

  const exercises = useLiveQuery(
    async () => {
      if (!day) return [] as Exercise[]
      return db.exercises.where('dayId').equals(day.id).sortBy('order')
    },
    [day?.id],
    [] as Exercise[],
  )

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

      {/* First-load placeholder — fills the gap before queries resolve */}
      {!ready && <HeroSkeleton />}

      {/* ── Cycle rail — pick any day; the dot marks the suggested next one ──── */}
      {dayList.length > 0 && (
        <CycleRail
          days={dayList}
          selectedId={day?.id}
          autoId={suggested?.id}
          onSelect={(id) => setOverrideId(id === suggested?.id ? null : id)}
        />
      )}

      {/* ── Hero — the selected day's plan ──────────────────────────────────── */}
      {day ? (
        <div
          className="card"
          style={{
            position: 'relative',
            borderRadius: 30,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: HERO_BACKGROUND,
            boxShadow: HERO_SHADOW,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.12em',
              color: isSuggested ? 'var(--color-volt)' : 'var(--color-sub)',
            }}
          >
            {isSuggested ? 'SUGGESTED NEXT' : dayOfRotationLabel(day, dayList)}
          </div>

          {/* name + focus */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontSize: 32,
                fontWeight: 780,
                letterSpacing: '-0.02em',
                color: 'var(--color-text)',
                lineHeight: 1.04,
              }}
            >
              {day.name}
            </div>
            {day.focus && (
              <span
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--color-volt)',
                  background: 'var(--color-volt-tint)',
                  borderRadius: 8,
                  padding: '3px 10px',
                }}
              >
                {day.focus}
              </span>
            )}
          </div>

          {/* plan — a hairline-ruled program sheet */}
          {exercises.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {exercises.map((ex, i) => (
                <li
                  key={ex.id}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    padding: '9px 0',
                    borderTop: i > 0 ? '1px solid var(--color-separator)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--color-text)',
                      lineHeight: 1.3,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {ex.name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--color-dim)',
                      fontFamily: 'var(--font-mono)',
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    <ExerciseSummary ex={ex} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          {editMode && (
            <button
              onClick={start}
              aria-label="Start workout"
              className="tap press"
              style={{
                height: 52,
                borderRadius: 26,
                background: 'var(--color-volt)',
                color: 'var(--color-on-volt)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 16,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                marginTop: 2,
              }}
            >
              <Play size={16} strokeWidth={2.5} fill="currentColor" />
              Start {day.name}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
