import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { fmtVolume, shortDate } from '@/lib/format'
import {
  bodyWeightStats,
  recentPRs,
  volumeLast7Days,
  weeklyVolume,
} from '@/lib/stats'
import { PRChip } from './Home'

export function Progress() {
  const bodyWeight = useLiveQuery(() => db.bodyWeight.toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const prs = useLiveQuery(() => db.prs.toArray(), [], [])

  const bw = useMemo(() => bodyWeightStats(bodyWeight), [bodyWeight])
  const bars = useMemo(() => weeklyVolume(sessions), [sessions])
  const last7 = volumeLast7Days(sessions)
  const recent = recentPRs(prs)

  const maxBar = Math.max(1, ...bars.map((b) => b.total))

  return (
    <div className="screen">
      <div className="screen-title">Progress</div>

      {/* Body weight */}
      <div
        className="card"
        style={{
          borderRadius: 26,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 640 }}>Body weight</div>
          {bw && bw.deltaThisMonth !== 0 && (
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--color-volt)',
                background: 'var(--color-volt-tint)',
                borderRadius: 99,
                padding: '4px 9px',
              }}
            >
              {bw.deltaThisMonth < 0 ? '−' : '+'}
              {Math.abs(bw.deltaThisMonth).toFixed(1)} lb this month
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <div
            className="tabular-nums"
            style={{ fontSize: 34, fontWeight: 740, letterSpacing: '-0.02em' }}
          >
            {bw ? bw.latest.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-sub)' }}>lbs</div>
        </div>
        {bw && (
          <svg
            viewBox="0 0 320 56"
            preserveAspectRatio="none"
            style={{ width: '100%', height: 56, display: 'block' }}
          >
            <polyline
              points={bw.polyline}
              fill="none"
              stroke="var(--color-volt)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
            <circle cx={bw.lastPoint.x} cy={bw.lastPoint.y} r={3.5} fill="var(--color-volt)" />
          </svg>
        )}
        {bw && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--color-dim)',
            }}
          >
            {bw.monthLabels.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        )}
      </div>

      {/* Weekly volume */}
      <div
        className="card"
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
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 640 }}>Weekly volume</div>
          <div style={{ fontSize: 13, color: 'var(--color-sub)' }}>
            <span style={{ color: 'var(--color-text)', fontWeight: 640 }}>
              {fmtVolume(last7)}
            </span>{' '}
            last 7 days
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64 }}>
          {bars.map((b, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 8 + (b.total / maxBar) * 56,
                borderRadius: 3,
                background: b.isCurrent
                  ? 'var(--color-volt)'
                  : 'rgba(255,255,255,0.16)',
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--color-dim)',
          }}
        >
          <span>8 wks ago</span>
          <span>This week</span>
        </div>
      </div>

      {/* Recent PRs */}
      <div className="card" style={{ borderRadius: 26, padding: '8px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 640, padding: '12px 0 4px' }}>
          Recent PRs
        </div>
        {recent.map((pr, i) => (
          <div
            key={pr.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 50,
              borderBottom:
                i === recent.length - 1 ? 'none' : '1px solid var(--color-separator)',
            }}
          >
            <PRChip />
            <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{pr.name}</div>
            <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 640 }}>
              {pr.load}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--color-sub)',
                width: 46,
                textAlign: 'right',
              }}
            >
              {shortDate(pr.date)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
