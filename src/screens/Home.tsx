import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/db'
import { startSession } from '@/lib/actions'
import { fmtVolumeCompact, weekdayShort } from '@/lib/format'
import {
  dayOfRotationLabel,
  exercisePreview,
  isRestDay,
  nextDay,
  todaysDay,
} from '@/lib/rotation'
import {
  heatmapColumns,
  latestPR,
  sessionsThisWeek,
  streakWeeks,
  volumeLast7Days,
} from '@/lib/stats'
import { Heatmap } from '@/components/Heatmap'
import { ProgressRing } from '@/components/ProgressRing'
import { PlusGlyph } from '@/components/icons'
import type { Exercise } from '@/db/types'

export function Home() {
  const navigate = useNavigate()
  const days = useLiveQuery(() => db.days.orderBy('id').toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const bodyWeight = useLiveQuery(() => db.bodyWeight.toArray(), [], [])
  const prs = useLiveQuery(() => db.prs.toArray(), [], [])

  const day = useMemo(() => todaysDay(days), [days])
  const next = useMemo(() => nextDay(days), [days])
  const exercises = useLiveQuery(
    async () => {
      if (!day) return [] as Exercise[]
      return db.exercises.where('dayId').equals(day.id).sortBy('order')
    },
    [day?.id],
    [] as Exercise[],
  )

  const rest = isRestDay()
  const doneThisWeek = sessionsThisWeek(sessions)
  const ringPct = Math.round((doneThisWeek / 6) * 100)
  const streak = streakWeeks(sessions)
  const vol7 = volumeLast7Days(sessions)
  const bw = bodyWeight.length
    ? [...bodyWeight].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.lbs
    : null
  const pr = latestPR(prs)
  const heat = useMemo(() => heatmapColumns(sessions), [sessions])

  async function start() {
    if (!day) return
    const ex = await db.exercises.where('dayId').equals(day.id).sortBy('order')
    await startSession(day, ex)
    navigate('/log')
  }

  return (
    <div className="screen">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 0 8px',
        }}
      >
        <div className="screen-title" style={{ padding: 0 }}>
          Workouts
        </div>
        {!rest && (
          <button
            onClick={start}
            aria-label="Start today's workout"
            className="card tap"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              borderColor: 'var(--color-pill-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-d9)',
            }}
          >
            <PlusGlyph />
          </button>
        )}
      </div>

      {/* Hero */}
      {day && !rest ? (
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
            {dayOfRotationLabel(day)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <ProgressRing pct={ringPct}>
              <span style={{ fontSize: 22, fontWeight: 680 }}>{doneThisWeek}</span>
            </ProgressRing>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  fontSize: 27,
                  fontWeight: 740,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text)',
                }}
              >
                {day.name}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--color-sub)' }}>
                {exercisePreview(exercises.map((e) => e.name))}
              </div>
            </div>
          </div>
          <button
            onClick={start}
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
            Start workout
          </button>
        </div>
      ) : (
        <div
          className="card"
          style={{
            borderRadius: 30,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.12em',
              color: 'var(--color-volt)',
            }}
          >
            REST DAY
          </div>
          <div style={{ fontSize: 27, fontWeight: 740, letterSpacing: '-0.02em' }}>
            Recover
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--color-sub)' }}>
            Next: {next?.name ?? '—'}
          </div>
        </div>
      )}

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <StatCard
          value={bw != null ? String(Math.round(bw)) : '—'}
          unit="lbs"
          label="Body weight · today"
          onClick={() => navigate('/progress')}
        />
        <StatCard
          value={fmtVolumeCompact(vol7)}
          unit="lbs"
          label="Volume · 7 days"
          onClick={() => navigate('/progress')}
        />
      </div>

      {/* Consistency */}
      <div
        className="card tap"
        onClick={() => navigate('/history')}
        style={{
          borderRadius: 26,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 640 }}>Consistency</div>
          <div style={{ fontSize: 12, color: 'var(--color-sub)' }}>
            {streak}-week streak{next ? ` · next: ${next.name}` : ''}
          </div>
        </div>
        <Heatmap columns={heat} tint="volt" />
      </div>

      {/* Latest PR */}
      {pr && (
        <div
          className="card tap"
          onClick={() => navigate('/progress')}
          style={{
            borderRadius: 26,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <PRChip />
          <div style={{ flex: 1, fontSize: 14, fontWeight: 560 }}>
            {pr.name} {pr.load}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-sub)' }}>
            {weekdayShort(pr.date)}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  value,
  unit,
  label,
  onClick,
}: {
  value: string
  unit: string
  label: string
  onClick: () => void
}) {
  return (
    <div
      className="card tap"
      onClick={onClick}
      style={{
        borderRadius: 26,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <div
          className="tabular-nums"
          style={{ fontSize: 28, fontWeight: 720, letterSpacing: '-0.02em' }}
        >
          {value}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-sub)' }}>{unit}</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-sub)' }}>{label}</div>
    </div>
  )
}

export function PRChip() {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: 'var(--color-on-volt)',
        background: 'var(--color-volt)',
        borderRadius: 6,
        padding: '3px 6px',
      }}
    >
      PR
    </div>
  )
}

