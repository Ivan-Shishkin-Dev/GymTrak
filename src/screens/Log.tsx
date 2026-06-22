import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/db'
import { finishSession, toggleSet, updateSetLoad } from '@/lib/actions'
import { useEditMode } from '@/lib/sync'
import { fmtClock } from '@/lib/format'
import { inferLoadType } from '@/lib/load'
import { BackChevron } from '@/components/icons'
import { LoadEditor, RepsField } from '@/components/LoadEditor'
import type { Exercise, WorkoutSet } from '@/db/types'

export function Log() {
  const navigate = useNavigate()
  const editMode = useEditMode()
  const [now, setNow] = useState(() => Date.now())
  // which set's weight/reps is being edited inline, and the draft text
  const [editingLoad, setEditingLoad] = useState<{ id: string; field: 'weight' | 'reps' } | null>(null)
  const [loadDraft, setLoadDraft] = useState('')
  // finished exercises the user has tapped back open to tweak
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

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
  const progressPct = total ? (done / total) * 100 : 0
  // the next set still to do, in workout order — gets the volt "you're here" ring
  const activeSetId =
    groups.flatMap((g) => g.sets).find((s) => s.completedAt == null)?.id ?? null

  async function onToggle(id: string) {
    if (!editMode) return
    const nowDone = await toggleSet(id)
    if (nowDone && 'vibrate' in navigator) navigator.vibrate(15)
  }

  function openLoad(e: React.MouseEvent, st: WorkoutSet, field: 'weight' | 'reps') {
    e.stopPropagation()
    if (!editMode) return
    setEditingLoad({ id: st.id, field })
    setLoadDraft(field === 'weight' ? st.weight : st.reps)
  }

  async function commitLoad(st: WorkoutSet) {
    if (!editingLoad || editingLoad.id !== st.id) return
    const field = editingLoad.field
    const weight = field === 'weight' ? loadDraft : st.weight
    const reps = field === 'reps' ? loadDraft : st.reps
    setEditingLoad(null)
    setLoadDraft('')
    await updateSetLoad(st.id, weight, reps)
  }

  function cancelLoad() {
    setEditingLoad(null)
    setLoadDraft('')
  }

  async function onFinish() {
    if (!editMode) return
    await finishSession(session!.id)
    navigate('/', { replace: true })
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        animation: 'sheet-in 0.36s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
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
        {/* Total elapsed time for the workout */}
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

      {/* Progress bar — fills as sets are completed */}
      <div style={{ padding: '0 20px 6px' }}>
        <div
          style={{
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
              width: `${progressPct}%`,
              transition: 'width 0.35s ease',
            }}
          />
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
          {editMode
            ? "Loads carried over from last time — tap a weight to edit it, tap the circle when a set's done"
            : 'Viewing a live workout — read only'}
        </div>

        {groups.map(({ ex, sets: exSets }) => {
          const exDone = exSets.every((s) => s.completedAt != null)
          const collapsed = exDone && !expanded.has(ex.id)

          // Finished exercise → compact one-line summary; tap to reopen and tweak.
          if (collapsed) {
            return (
              <div
                key={ex.id}
                onClick={() => setExpanded((prev) => new Set(prev).add(ex.id))}
                className="card tap"
                style={{
                  borderRadius: 22,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderColor: 'var(--color-volt-tint)',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'var(--color-volt)',
                    color: 'var(--color-on-volt)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--color-sub)' }}>
                  {ex.name}
                </div>
                <div
                  className="tabular-nums"
                  style={{ fontSize: 12, color: 'var(--color-dim)', fontFamily: 'var(--font-mono)' }}
                >
                  {exSets.length} {exSets.length === 1 ? 'set' : 'sets'}
                </div>
              </div>
            )
          }

          return (
            <div
              key={ex.id}
              className="card"
              style={{ borderRadius: 22, padding: '8px 18px 12px' }}
            >
              <div style={{ padding: '10px 0 4px' }}>
                <div style={{ fontSize: 15, fontWeight: 640 }}>{ex.name}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {exSets.map((st, i) => {
                  const isDone = st.completedAt != null
                  const isActive = st.id === activeSetId
                  const isEditWeight = editingLoad?.id === st.id && editingLoad.field === 'weight'
                  const isEditReps = editingLoad?.id === st.id && editingLoad.field === 'reps'
                  return (
                    // Toggle row — tapping anywhere here marks the set done/undone
                    <div
                      key={st.id}
                      onClick={() => onToggle(st.id)}
                      className="tap"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        height: 46,
                        marginInline: -10,
                        paddingInline: 10,
                        borderRadius: 12,
                        opacity: isDone ? 0.4 : 1,
                        background: isActive ? 'var(--color-volt-tint)' : 'transparent',
                        transition: 'opacity 0.2s ease, background 0.2s ease',
                      }}
                    >
                      <div style={{ width: 42, fontSize: 12, color: 'var(--color-sub)' }}>
                        Set {i + 1}
                      </div>
                      {/* weight — tap to edit; empty space in this cell still toggles the set */}
                      <div style={{ flex: 1 }}>
                        {isEditWeight ? (
                          <LoadEditor
                            compact
                            autoFocus
                            value={loadDraft}
                            loadType={ex.loadType ?? inferLoadType(ex.weight)}
                            onChange={setLoadDraft}
                            onCommit={() => commitLoad(st)}
                            onCancel={cancelLoad}
                          />
                        ) : (
                          <span
                            className={`tabular-nums${editMode ? ' tap' : ''}`}
                            onClick={editMode ? (e) => openLoad(e, st, 'weight') : undefined}
                            style={{
                              fontSize: 16,
                              fontWeight: 620,
                              borderBottom: editMode
                                ? '1px dashed var(--color-check-border)'
                                : 'none',
                              paddingBottom: 1,
                            }}
                          >
                            {st.weight || '—'}
                          </span>
                        )}
                      </div>
                      {/* reps — tap to edit */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 48 }}>
                        {isEditReps ? (
                          <RepsField
                            compact
                            autoFocus
                            value={loadDraft}
                            onChange={setLoadDraft}
                            onCommit={() => commitLoad(st)}
                            onCancel={cancelLoad}
                          />
                        ) : (
                          <span
                            className={`tabular-nums${editMode ? ' tap' : ''}`}
                            onClick={editMode ? (e) => openLoad(e, st, 'reps') : undefined}
                            style={{
                              fontSize: 14,
                              color: 'var(--color-sub)',
                              borderBottom: editMode
                                ? '1px dashed var(--color-separator)'
                                : 'none',
                              paddingBottom: 1,
                            }}
                          >
                            {st.reps}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: `1.5px solid ${isDone || isActive ? 'var(--color-volt)' : 'var(--color-check-border)'}`,
                          background: isDone ? 'var(--color-volt)' : 'transparent',
                          boxShadow: isActive && !isDone ? '0 0 0 4px var(--color-volt-tint)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          fontWeight: 800,
                          color: isDone ? 'var(--color-on-volt)' : 'transparent',
                          animation: isDone ? 'set-pop 0.2s ease' : undefined,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer — just the finish action once any set is done (editors only) */}
      {done > 0 && editMode && (
        <div
          style={{
            borderTop: '1px solid var(--color-card-border)',
            background: 'rgba(10,10,11,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: `14px 20px calc(30px + env(safe-area-inset-bottom))`,
          }}
        >
          <button
            onClick={onFinish}
            className="tap press"
            style={{
              width: '100%',
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
        </div>
      )}
    </div>
  )
}
