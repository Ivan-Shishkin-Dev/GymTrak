import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO, subDays } from 'date-fns'
import { Check, ChevronDown, Dumbbell, Footprints, Trash2, Trophy } from 'lucide-react'
import { db } from '@/db/db'
import { deleteSession } from '@/lib/actions'
import { dateKey, fmtClock } from '@/lib/format'
import { isRun } from '@/lib/session'
import { pacePerMile, paceLabel } from '@/lib/program'
import { useEditMode } from '@/lib/sync'
import { SyncBar } from '@/components/SyncBar'
import type { Session, WorkoutSet } from '@/db/types'

type Filter = 'all' | 'lift' | 'run'

export function History() {
  const editMode = useEditMode()
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const sets = useLiveQuery(() => db.sets.toArray(), [], [])
  const days = useLiveQuery(() => db.days.toArray(), [], [])

  const complete = useMemo(
    () => sessions
      .filter((s) => s.finishedAt != null && !s.deleted)
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
    [sessions],
  )
  const visible = complete.filter((s) => filter === 'all' || (filter === 'run') === isRun(s))
  const recentKey = dateKey(subDays(new Date(), 27))
  const recent = complete.filter((s) => s.date >= recentKey)
  const minutes = Math.round(recent.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / 60)
  const historySessionIds = useMemo(() => new Set(complete.map((session) => session.id)), [complete])
  const bestByExercise = useMemo(() => {
    const best = new Map<string, number>()
    for (const set of sets) {
      if (!historySessionIds.has(set.sessionId) || set.completedAt == null || set.weightNum == null) continue
      best.set(set.exerciseId, Math.max(best.get(set.exerciseId) ?? -Infinity, set.weightNum))
    }
    return best
  }, [sets, historySessionIds])

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="screen-title" style={{ padding: 0 }}>History</div>
          <div style={{ marginTop: 5, fontSize: 13, color: 'var(--color-sub)' }}>
            What you actually did
          </div>
        </div>
        <SyncBar />
      </div>

      <div className="card" style={{ borderRadius: 16, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <Summary value={String(recent.length)} label="sessions · 4 weeks" />
        <Summary value={`${minutes}`} unit="min" label="training · 4 weeks" divider />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {(['all', 'lift', 'run'] as const).map((key) => (
          <button
            key={key}
            className="tap"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 10,
              border: '1px solid var(--color-pill-border)',
              background: filter === key ? 'var(--color-volt-tint)' : 'transparent',
              color: filter === key ? 'var(--color-volt)' : 'var(--color-sub)',
              fontSize: 13,
              fontWeight: 650,
            }}
          >
            {key === 'all' ? 'All' : key === 'lift' ? 'Lifts' : 'Runs'}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card" style={{ borderRadius: 16, padding: 22, color: 'var(--color-sub)', lineHeight: 1.5 }}>
          Completed sessions will appear here with their sets and run metrics.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((session, index) => {
            const previousDate = index > 0 ? visible[index - 1].date : null
            const showDate = previousDate !== session.date
            const sessionSets = sets.filter((s) => s.sessionId === session.id && s.completedAt != null)
            const day = days.find((d) => d.id === session.dayId)
            return (
              <div key={session.id}>
                {showDate && (
                  <div className="eyebrow" style={{ color: 'var(--color-dim)', padding: '10px 2px 7px' }}>
                    {format(parseISO(session.date), 'EEEE · MMM d').toUpperCase()}
                  </div>
                )}
                <SessionCard
                  session={session}
                  title={session.dayNameSnapshot ?? day?.name ?? session.run?.label ?? (isRun(session) ? 'Run' : 'Workout')}
                  sets={sessionSets}
                  allSets={sets}
                  historySessionIds={historySessionIds}
                  bestByExercise={bestByExercise}
                  open={openId === session.id}
                  onToggle={() => setOpenId(openId === session.id ? null : session.id)}
                  canDelete={editMode}
                  confirmingDelete={deleteId === session.id}
                  onAskDelete={() => setDeleteId(session.id)}
                  onCancelDelete={() => setDeleteId(null)}
                  onDelete={async () => {
                    await deleteSession(session.id)
                    setDeleteId(null)
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Summary({ value, unit, label, divider }: { value: string; unit?: string; label: string; divider?: boolean }) {
  return (
    <div style={{ padding: '15px 17px', borderLeft: divider ? '1px solid var(--color-separator)' : undefined }}>
      <div className="display tabular-nums" style={{ fontSize: 25, fontWeight: 700 }}>
        {value}{unit && <span style={{ marginLeft: 4, fontSize: 13, color: 'var(--color-sub)' }}>{unit}</span>}
      </div>
      <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--color-dim)' }}>{label}</div>
    </div>
  )
}

function SessionCard({
  session,
  title,
  sets,
  allSets,
  historySessionIds,
  bestByExercise,
  open,
  onToggle,
  canDelete,
  confirmingDelete,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  session: Session
  title: string
  sets: WorkoutSet[]
  allSets: WorkoutSet[]
  historySessionIds: Set<string>
  bestByExercise: Map<string, number>
  open: boolean
  onToggle: () => void
  canDelete: boolean
  confirmingDelete: boolean
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => Promise<void>
}) {
  const running = isRun(session)
  const actualMinutes = session.run?.actualMin ?? (session.durationSec != null ? Math.round(session.durationSec / 60) : null)
  const groups = new Map<string, WorkoutSet[]>()
  for (const set of sets) {
    const group = groups.get(set.exerciseId)
    if (group) group.push(set)
    else groups.set(set.exerciseId, [set])
  }
  const pace = running && session.run ? pacePerMile(session.run.actualMin, session.run.actualMi) : null
  const plannedElsewhere = session.scheduledDate && session.scheduledDate !== session.date

  return (
    <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <button
        className="tap"
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: '100%', padding: '14px 16px', border: 0, background: 'transparent', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
      >
        <span style={{ color: 'var(--color-volt)', display: 'flex' }}>
          {running ? <Footprints size={18} /> : <Dumbbell size={18} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="display" style={{ display: 'block', fontSize: 19, fontWeight: 700 }}>{title}</span>
          <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: 'var(--color-sub)' }}>
            {running
              ? `${actualMinutes ?? '—'} min${session.run?.actualMi != null ? ` · ${session.run.actualMi} mi` : ''}`
              : `${sets.length} sets`}
            {session.durationSec != null ? ` · ${fmtClock(session.durationSec)}` : ''}
          </span>
        </span>
        <ChevronDown size={18} style={{ color: 'var(--color-dim)', transform: open ? 'rotate(180deg)' : undefined }} />
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--color-separator)', padding: '12px 16px 16px' }}>
          {plannedElsewhere && (
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--color-sub)' }}>
              Scheduled for {format(parseISO(session.scheduledDate!), 'EEE, MMM d')}
            </div>
          )}
          {running && session.run ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <Metric label="Planned" value={`${session.run.plannedMin} min`} />
              <Metric label="Completed" value={session.run.actualMin != null ? `${session.run.actualMin} min` : 'Not entered'} />
              <Metric label="Pace" value={pace != null ? paceLabel(pace) : 'Not entered'} />
              <Metric label="Avg heart rate" value={session.run.avgHr != null ? `${session.run.avgHr} bpm` : 'Not entered'} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[...groups.values()].map((group) => {
                const first = group[0]
                const priorSets = allSets
                  .filter((s) => historySessionIds.has(s.sessionId) && s.exerciseId === first.exerciseId && s.completedAt != null && s.completedAt < (first.completedAt ?? 0))
                  .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
                const recentBySession = new Map<string, WorkoutSet>()
                for (const set of priorSets) {
                  if (!recentBySession.has(set.sessionId)) recentBySession.set(set.sessionId, set)
                  if (recentBySession.size === 3) break
                }
                const recent = [...recentBySession.values()]
                return (
                  <div key={first.exerciseId} style={{ padding: '10px 0', borderTop: '1px solid var(--color-separator)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 650 }}>{first.exerciseName}</span>
                      {group.some((s) => s.weightNum != null && s.weightNum === bestByExercise.get(s.exerciseId)) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-volt)', fontSize: 10.5, fontWeight: 700 }}>
                          <Trophy size={12} /> BEST
                        </span>
                      )}
                    </div>
                    <div className="tabular-nums" style={{ marginTop: 5, fontSize: 12.5, color: 'var(--color-sub)', lineHeight: 1.6 }}>
                      {group.sort((a, b) => a.setIndex - b.setIndex).map((s) => `${s.weight || '—'} ${s.reps}`.trim()).join(' · ')}
                    </div>
                    {group.some((s) => (s.targetWeight != null && s.targetWeight !== s.weight) || (s.targetReps != null && s.targetReps !== s.reps)) && (
                      <div className="tabular-nums" style={{ marginTop: 2, fontSize: 11, color: 'var(--color-dim)' }}>
                        Planned: {group.map((s) => `${s.targetWeight ?? (s.weight || '—')} ${s.targetReps ?? s.reps}`.trim()).join(' · ')}
                      </div>
                    )}
                    <div style={{ marginTop: 3, fontSize: 11, color: 'var(--color-dim)' }}>
                      {recent.length
                        ? `Recent: ${recent.map((set) => `${set.weight || '—'} ${set.reps}`.trim()).join(' · ')}`
                        : 'First logged performance'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {canDelete && (
            <div style={{ marginTop: 10 }}>
              {confirmingDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-sub)' }}>
                  <span style={{ flex: 1 }}>Remove this entry?</span>
                  <button className="tap" onClick={onCancelDelete} style={quietAction}>Cancel</button>
                  <button className="tap" onClick={() => void onDelete()} style={{ ...quietAction, color: 'var(--color-red)' }}>Remove</button>
                </div>
              ) : (
                <button className="tap" onClick={onAskDelete} style={{ ...quietAction, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 size={13} /> Remove entry
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--color-separator)', borderRadius: 10, padding: '10px 11px' }}>
      <div className="eyebrow" style={{ color: 'var(--color-dim)', fontSize: 9.5 }}>{label.toUpperCase()}</div>
      <div style={{ marginTop: 4, fontSize: 13.5, fontWeight: 630 }}>{value}</div>
    </div>
  )
}

const quietAction: React.CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--color-sub)',
  padding: '7px 5px',
  fontSize: 12,
  fontWeight: 630,
}
