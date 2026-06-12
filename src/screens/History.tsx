import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import {
  calendarMonth,
  recentSessions,
  sessionsThisWeek,
  streakWeeks,
} from '@/lib/stats'
import type { CalendarCell } from '@/lib/stats'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function History() {
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const days = useLiveQuery(() => db.days.orderBy('id').toArray(), [], [])

  const thisWeek = sessionsThisWeek(sessions)
  const streak = streakWeeks(sessions)
  const cal = useMemo(() => calendarMonth(sessions), [sessions])
  const recent = useMemo(() => recentSessions(sessions, days), [sessions, days])

  return (
    <div className="screen">
      <div className="screen-title">History</div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <SmallStat value={String(thisWeek)} unit="/ 6" label="Sessions this week" />
        <SmallStat value={String(streak)} unit="wks" label="Current streak" />
      </div>

      {/* Calendar */}
      <div className="card" style={{ borderRadius: 26, padding: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingBottom: 14,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 640 }}>{cal.title}</div>
          <div style={{ fontSize: 12, color: 'var(--color-sub)' }}>
            {cal.plannedLabel}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7,1fr)',
            gap: 4,
            justifyItems: 'center',
            paddingBottom: 6,
          }}
        >
          {WEEKDAYS.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--color-dim)' }}>
              {w}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7,1fr)',
            gap: 4,
            justifyItems: 'center',
          }}
        >
          {cal.cells.map((c, i) => (
            <DayCell key={i} cell={c} />
          ))}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="card" style={{ borderRadius: 26, padding: '6px 20px' }}>
        {recent.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: 56,
              borderBottom:
                i === recent.length - 1 ? 'none' : '1px solid var(--color-separator)',
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-sub)' }}>{s.when}</div>
            </div>
            <div
              className="tabular-nums"
              style={{ fontSize: 13.5, color: 'var(--color-sub)' }}
            >
              {s.vol}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SmallStat({
  value,
  unit,
  label,
}: {
  value: string
  unit: string
  label: string
}) {
  return (
    <div className="card" style={{ borderRadius: 22, padding: '16px 18px' }}>
      <div className="tabular-nums" style={{ fontSize: 24, fontWeight: 720 }}>
        {value}{' '}
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-sub)' }}>
          {unit}
        </span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-sub)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

function DayCell({ cell }: { cell: CalendarCell }) {
  if (cell.n == null) return <div style={{ width: 36, height: 36 }} />
  const { bg, color, fw } = cellStyle(cell.state)
  return (
    <div
      className="tabular-nums"
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        background: bg,
        color,
        fontWeight: fw,
      }}
    >
      {cell.n}
    </div>
  )
}

function cellStyle(state: CalendarCell['state']): {
  bg: string
  color: string
  fw: number
} {
  switch (state) {
    case 'today':
      return { bg: 'var(--color-volt)', color: 'var(--color-on-volt)', fw: 700 }
    case 'workout':
      return { bg: 'rgba(255,255,255,0.10)', color: 'var(--color-text)', fw: 500 }
    case 'future':
      return { bg: 'transparent', color: 'var(--color-future)', fw: 500 }
    case 'rest':
    default:
      return { bg: 'transparent', color: '#5E5E63', fw: 500 }
  }
}
