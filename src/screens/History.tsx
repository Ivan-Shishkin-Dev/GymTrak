import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { db } from '@/db/db'
import { calendarMonth, sessionOnDate } from '@/lib/stats'
import type { CalendarCell } from '@/lib/stats'
import type { Day, PR, Session, WorkoutSet } from '@/db/types'
import { addPR, deletePR } from '@/lib/actions'
import { PlusGlyph, TrashGlyph } from '@/components/icons'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDuration(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`
}

function mostRecentSession(sessions: Session[]): Session | null {
  const finished = sessions.filter((s) => s.finishedAt != null && !s.deleted)
  if (!finished.length) return null
  return finished.reduce((best, s) =>
    s.finishedAt! > best.finishedAt! ? s : best,
  )
}

/* ── Main screen ─────────────────────────────────────────────────────────── */

export function History() {
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const days = useLiveQuery(() => db.days.orderBy('id').toArray(), [], [])
  const prs = useLiveQuery(
    () => db.prs.orderBy('at').reverse().toArray(),
    [],
    [] as PR[],
  )

  const cal = useMemo(() => calendarMonth(sessions), [sessions])

  // Default selected date = most recent session's date key
  const defaultKey = useMemo(
    () => mostRecentSession(sessions)?.date ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions.length],
  )
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const activeKey = selectedKey ?? defaultKey

  const selectedSession = useMemo(
    () => (activeKey ? sessionOnDate(sessions, activeKey) : null),
    [sessions, activeKey],
  )

  // Live-query sets keyed on selectedSession id
  const rawSets = useLiveQuery(
    () =>
      selectedSession
        ? db.sets.where('sessionId').equals(selectedSession.id).toArray()
        : Promise.resolve([] as WorkoutSet[]),
    [selectedSession?.id],
    [] as WorkoutSet[],
  )

  // Group sets by exerciseName, preserving order via first-seen setIndex
  const exerciseGroups = useMemo(() => {
    const sorted = [...rawSets].sort((a, b) => a.setIndex - b.setIndex)
    const order: string[] = []
    const map = new Map<string, WorkoutSet[]>()
    for (const s of sorted) {
      if (!map.has(s.exerciseName)) {
        order.push(s.exerciseName)
        map.set(s.exerciseName, [])
      }
      map.get(s.exerciseName)!.push(s)
    }
    return order.map((name) => ({ name, sets: map.get(name)! }))
  }, [rawSets])

  // Find day metadata for selected session
  const selectedDay = useMemo<Day | null>(
    () =>
      selectedSession
        ? (days.find((d) => d.id === selectedSession.dayId) ?? null)
        : null,
    [selectedSession, days],
  )

  // PR add form state
  const [prLift, setPrLift] = useState('')
  const [prValue, setPrValue] = useState('')
  const [showAddPR, setShowAddPR] = useState(false)

  async function handleAddPR() {
    if (!prLift.trim() || !prValue.trim()) return
    await addPR(prLift.trim(), prValue.trim())
    setPrLift('')
    setPrValue('')
    setShowAddPR(false)
  }

  function handleCellTap(cell: CalendarCell) {
    if (cell.key == null) return
    const session = sessionOnDate(sessions, cell.key)
    if (!session) return
    setSelectedKey(cell.key)
  }

  const activePrs = prs.filter((p) => !p.deleted)

  return (
    <div className="screen">
      <div className="screen-title">History</div>

      {/* ── Personal records ───────────────────────────────────────────── */}
      <div className="card" style={{ borderRadius: 26, padding: 20 }}>
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: activePrs.length > 0 || showAddPR ? 14 : 0,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 640 }}>Personal records</div>
          <button
            className="tap"
            onClick={() => setShowAddPR((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 6,
              color: showAddPR ? 'var(--color-sub)' : 'var(--color-volt)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 13,
            }}
          >
            <PlusGlyph size={13} />
            <span>{showAddPR ? 'Cancel' : 'Add'}</span>
          </button>
        </div>

        {/* Add form */}
        {showAddPR && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: activePrs.length > 0 ? 14 : 0,
              padding: '12px 0 4px',
              borderTop:
                activePrs.length > 0 || !showAddPR
                  ? 'none'
                  : undefined,
            }}
          >
            <input
              value={prLift}
              onChange={(e) => setPrLift(e.target.value)}
              placeholder="Lift (e.g. Bench)"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-pill-border)',
                borderRadius: 12,
                color: 'var(--color-text)',
                padding: '10px 12px',
                fontSize: 14,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            <input
              value={prValue}
              onChange={(e) => setPrValue(e.target.value)}
              placeholder="Value (e.g. 225 × 4)"
              onKeyDown={(e) => e.key === 'Enter' && handleAddPR()}
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-pill-border)',
                borderRadius: 12,
                color: 'var(--color-text)',
                padding: '10px 12px',
                fontSize: 14,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleAddPR}
              style={{
                background: 'var(--color-volt)',
                color: 'var(--color-on-volt)',
                border: 'none',
                borderRadius: 12,
                padding: '10px 0',
                fontSize: 14,
                fontWeight: 640,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Save PR
            </button>
          </div>
        )}

        {/* PR list */}
        {activePrs.length === 0 && !showAddPR && (
          <div style={{ fontSize: 13, color: 'var(--color-dim)', paddingBottom: 2 }}>
            No PRs logged yet
          </div>
        )}
        {activePrs.map((pr, i) => (
          <div
            key={pr.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingTop: i === 0 ? 0 : 11,
              paddingBottom: i === activePrs.length - 1 ? 0 : 11,
              borderBottom:
                i === activePrs.length - 1
                  ? 'none'
                  : '1px solid var(--color-separator)',
            }}
          >
            {/* Lift + value */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>{pr.lift}</span>
                <span
                  className="tabular-nums"
                  style={{ fontSize: 14, color: 'var(--color-volt)' }}
                >
                  {pr.value}
                </span>
              </div>
              <div
                className="tabular-nums"
                style={{ fontSize: 12, color: 'var(--color-sub)' }}
              >
                {format(new Date(pr.at), 'MMM d · h:mm a')}
              </div>
            </div>
            {/* Delete */}
            <button
              className="tap"
              onClick={() => deletePR(pr.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: 6,
                color: 'var(--color-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <TrashGlyph size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Calendar ───────────────────────────────────────────────────── */}
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
        {/* Weekday header */}
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
        {/* Day cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7,1fr)',
            gap: 4,
            justifyItems: 'center',
          }}
        >
          {cal.cells.map((c, i) => (
            <DayCell
              key={i}
              cell={c}
              selected={c.key === activeKey}
              onTap={handleCellTap}
            />
          ))}
        </div>
      </div>

      {/* ── Session detail ─────────────────────────────────────────────── */}
      {selectedSession && (
        <div className="card" style={{ borderRadius: 26, padding: 20 }}>
          {/* Day name + focus */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 640, marginBottom: 2 }}>
              {selectedDay ? `${selectedDay.name}` : 'Session'}
              {selectedDay?.focus && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--color-sub)',
                    marginLeft: 8,
                  }}
                >
                  {selectedDay.focus}
                </span>
              )}
            </div>
            {/* Date · time · duration */}
            <div
              className="tabular-nums"
              style={{ fontSize: 12, color: 'var(--color-sub)' }}
            >
              {format(new Date(selectedSession.startedAt), 'MMM d, yyyy · h:mm a')}
              {selectedSession.durationSec != null && (
                <span style={{ color: 'var(--color-dim)', marginLeft: 6 }}>
                  · {fmtDuration(selectedSession.durationSec)}
                </span>
              )}
            </div>
          </div>

          {/* Exercise groups */}
          {exerciseGroups.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-dim)' }}>No sets recorded</div>
          )}
          {exerciseGroups.map((group, gi) => (
            <div
              key={group.name}
              style={{
                marginBottom: gi === exerciseGroups.length - 1 ? 0 : 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-d9)',
                  marginBottom: 7,
                  letterSpacing: '0.01em',
                }}
              >
                {group.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {group.sets.map((s, si) => (
                  <div key={s.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Set number */}
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: 11,
                          color: 'var(--color-dim)',
                          width: 16,
                          flexShrink: 0,
                        }}
                      >
                        {si + 1}
                      </span>
                      {/* weight + reps — the reps token already carries its own "×" */}
                      <span
                        className="tabular-nums"
                        style={{ fontSize: 13.5, color: 'var(--color-text)' }}
                      >
                        {s.weight} {s.reps}
                      </span>
                    </div>
                    {/* Per-set comment */}
                    {s.comment && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--color-faint)',
                          marginLeft: 24,
                          marginTop: 2,
                          fontStyle: 'italic',
                        }}
                      >
                        {s.comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── DayCell ─────────────────────────────────────────────────────────────── */

function DayCell({
  cell,
  selected,
  onTap,
}: {
  cell: CalendarCell
  selected: boolean
  onTap: (cell: CalendarCell) => void
}) {
  if (cell.n == null) return <div style={{ width: 36, height: 36 }} />
  const { bg, color, fw } = cellStyle(cell.state)
  const tappable = cell.state === 'workout'
  return (
    <div
      className={tappable ? 'tap tabular-nums' : 'tabular-nums'}
      onClick={tappable ? () => onTap(cell) : undefined}
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
        border: selected && tappable ? '1px solid var(--color-volt)' : '1px solid transparent',
        boxSizing: 'border-box',
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
    case 'idle':
    case 'empty':
    default:
      return { bg: 'transparent', color: '#5E5E63', fw: 500 }
  }
}
