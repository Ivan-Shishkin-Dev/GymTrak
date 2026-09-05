import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/db'
import { isRun } from '@/lib/session'
import {
  finishSession,
  toggleSet,
  updateSetLoad,
  updateExercise,
  moveExercise,
  addSetToSession,
  removeSet,
  addExerciseToSession,
  removeExerciseFromSession,
  discardSession,
} from '@/lib/actions'
import { useEditMode } from '@/lib/sync'
import { startRest, stopRest } from '@/lib/restTimer'
import { fmtClock } from '@/lib/format'
import { formatLoad, inferLoadType, parseLoad } from '@/lib/load'
import { BackChevron, PlusGlyph, TrashGlyph } from '@/components/icons'
import { RestBar } from '@/components/RestBar'
import { MoveButtons } from '@/components/MoveButtons'
import { LoadEditor, RepsField } from '@/components/LoadEditor'
import type { Exercise, LoadType, WorkoutSet } from '@/db/types'
import { DiscardDialog } from '@/components/DiscardDialog'

type Group = { ex: Exercise; sets: WorkoutSet[] }

/** Compact load-type chips for switching an exercise's load notation in-workout. */
const LOAD_TYPES: { key: LoadType; label: string }[] = [
  { key: 'weight', label: 'Weight' },
  { key: 'machine', label: 'Machine' },
  { key: 'plates', label: 'Plates' },
  { key: 'bodyweight', label: 'Body' },
  { key: 'free', label: 'Other' },
]

export function Log() {
  const navigate = useNavigate()
  const editMode = useEditMode()
  const [now, setNow] = useState(() => Date.now())
  // which set's weight/reps is being edited inline, and the draft text
  const [editingLoad, setEditingLoad] = useState<{ id: string; field: 'weight' | 'reps' } | null>(null)
  const [loadDraft, setLoadDraft] = useState('')
  // finished exercises the user has tapped back open to tweak
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  // structural edit mode within the workout (reorder / add-remove sets & exercises)
  const [editing, setEditing] = useState(false)
  // inline exercise rename in progress
  const [nameDraft, setNameDraft] = useState<{ id: string; text: string } | null>(null)
  // guard: "Finish workout" asks before ending the session (unticked sets are dropped)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [focusMode, setFocusMode] = useState(true)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // The single open session, if it's a lift. A run lives on /run — it has no day
  // and no sets, so letting one through here renders a blank screen.
  const open = useLiveQuery(
    () => db.sessions.filter((s) => s.finishedAt == null && !s.deleted).toArray(),
    [],
  )
  const session = open?.find((s) => !isRun(s))
  const openRun = open?.find(isRun)

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

  // No open lift (opened /log directly, or just finished) → leave. If the thing
  // that's actually running is a run, hand over to /run rather than dropping the
  // user Home in the middle of it.
  useEffect(() => {
    if (open === undefined || session) return
    navigate(openRun ? '/run' : '/', { replace: true })
  }, [open, session, openRun, navigate])

  if (!session || !day) return null

  const groups: Group[] = exercises
    .map((ex) => ({
      ex,
      sets: sets
        .filter((s) => s.exerciseId === ex.id)
        .sort((a, b) => a.setIndex - b.setIndex),
    }))
    .filter((g) => g.sets.length > 0)

  const isDoneGroup = (g: Group) => g.sets.every((s) => s.completedAt != null)
  const activeGroups = groups.filter((g) => !isDoneGroup(g))
  const doneGroups = groups.filter(isDoneGroup)

  const done = sets.filter((s) => s.completedAt != null).length
  const total = sets.length
  const elapsed = Math.max(0, Math.floor((now - session.startedAt) / 1000))
  const progressPct = total ? (done / total) * 100 : 0
  // the next set still to do, in workout order — gets the volt "you're here" ring
  const activeSetId =
    groups.flatMap((g) => g.sets).find((s) => s.completedAt == null)?.id ?? null
  const focusedGroup = groups.find((g) => g.sets.some((s) => s.id === activeSetId))
  const visibleActiveGroups = focusMode && focusedGroup ? [focusedGroup] : activeGroups

  async function onToggle(id: string, exId: string) {
    if (!editMode || editing) return
    // A set can only be tapped from the expanded view, so dropping its exercise
    // from `expanded` here lets it re-collapse into the Done pile once complete
    // again (and is harmless while it's active — active cards always show in full).
    setExpanded((prev) => {
      if (!prev.has(exId)) return prev
      const next = new Set(prev)
      next.delete(exId)
      return next
    })
    const nowDone = await toggleSet(id)
    if (nowDone) {
      if ('vibrate' in navigator) navigator.vibrate(15)
      const exercise = exercises.find((ex) => ex.id === exId)
      startRest(exercise?.restSeconds) // per-exercise target, falling back to the global default
    }
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

  async function adjustLoad(st: WorkoutSet, ex: Exercise, direction: -1 | 1) {
    const type = ex.loadType ?? inferLoadType(st.weight)
    if (type === 'free') return
    const parsed = parseLoad(st.weight, type)
    const increment = ex.loadIncrement ?? (type === 'plates' || type === 'machine' ? 1 : 5)
    if (type === 'weight' || (type === 'machine' && !parsed.max) || type === 'plates') {
      parsed.n = Math.max(0, (parsed.n ?? 0) + increment * direction)
    } else {
      parsed.add = (parsed.add ?? 0) + increment * direction
    }
    await updateSetLoad(st.id, formatLoad(parsed), st.reps)
  }

  function cancelLoad() {
    setEditingLoad(null)
    setLoadDraft('')
  }

  async function commitName() {
    const draft = nameDraft
    setNameDraft(null)
    if (!draft) return
    const text = draft.text.trim()
    if (text) await updateExercise(draft.id, { name: text })
  }

  async function proceedFinish() {
    if (!editMode) return
    const completedSessionId = session!.id
    const completedLabel = day!.name
    setConfirmFinish(false)
    stopRest()
    await finishSession(completedSessionId)
    navigate('/', {
      replace: true,
      state: { completedSessionId, completedLabel },
    })
  }

  async function onAddExercise() {
    const id = await addExerciseToSession(session!.id, session!.dayId)
    setNameDraft({ id, text: 'New exercise' })
  }

  async function proceedDiscard() {
    stopRest()
    await discardSession(session!.id)
    navigate('/', { replace: true })
  }

  /* ── one exercise card with its set rows ──────────────────────────────────
     `editable` adds the in-workout structural controls (reorder / rename / type
     / add-remove sets). Done-but-reopened cards render with editable=false.
     Called directly (not as <JSX/>) so it stays inline in this render — a nested
     component would get a fresh identity each render and remount, dropping focus
     from the inline editors. */
  function renderCard(g: Group, fullIdx: number, editable: boolean) {
    const { ex, sets: exSets } = g
    const loadType = ex.loadType ?? inferLoadType(ex.weight)
    const renaming = nameDraft?.id === ex.id

    return (
      <div key={ex.id} className="card" style={{ borderRadius: 16, padding: '8px 18px 12px' }}>
        {/* header — name, plus reorder / delete when editing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 4px' }}>
          {editable && (
            <div style={{ display: 'flex', flexShrink: 0, marginLeft: -4 }}>
              <MoveButtons
                onMove={(dir) => moveExercise(ex.id, dir)}
                canUp={fullIdx > 0}
                canDown={fullIdx < groups.length - 1}
              />
            </div>
          )}
          {renaming ? (
            <input
              value={nameDraft!.text}
              autoFocus
              onChange={(e) => setNameDraft({ id: ex.id, text: e.target.value })}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') setNameDraft(null)
              }}
              style={{
                flex: 1,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-volt)',
                borderRadius: 8,
                color: 'var(--color-text)',
                padding: '5px 8px',
                fontSize: 15,
                fontWeight: 640,
                outline: 'none',
              }}
            />
          ) : (
            <div
              className={editable ? 'tap' : undefined}
              onClick={editable ? () => setNameDraft({ id: ex.id, text: ex.name }) : undefined}
              style={{ flex: 1, fontSize: 15, fontWeight: 640 }}
            >
              {ex.name}
            </div>
          )}
          {editable && (
            <button
              className="tap"
              aria-label="Remove exercise"
              onClick={() => removeExerciseFromSession(session!.id, ex.id)}
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                color: 'var(--color-faint)',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <TrashGlyph />
            </button>
          )}
        </div>

        {/* load-type chips — only while editing */}
        {editable && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '2px 0 8px' }}>
            {LOAD_TYPES.map(({ key, label }) => {
              const active = loadType === key
              return (
                <button
                  key={key}
                  className="tap"
                  onClick={() => updateExercise(ex.id, { loadType: key })}
                  style={{
                    height: 26,
                    padding: '0 10px',
                    borderRadius: 13,
                    border: active ? '1px solid var(--color-volt)' : '1px solid var(--color-pill-border)',
                    background: active ? 'var(--color-volt-tint)' : 'transparent',
                    color: active ? 'var(--color-volt)' : 'var(--color-sub)',
                    fontSize: 11.5,
                    fontWeight: 620,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* set rows */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {exSets.map((st, i) => {
            const isDone = st.completedAt != null
            const isActive = st.id === activeSetId
            const isEditWeight = editingLoad?.id === st.id && editingLoad.field === 'weight'
            const isEditReps = editingLoad?.id === st.id && editingLoad.field === 'reps'
            return (
              <div
                key={st.id}
                onClick={editable ? undefined : () => onToggle(st.id, ex.id)}
                role={editable ? undefined : 'button'}
                tabIndex={editable ? undefined : 0}
                onKeyDown={editable ? undefined : (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void onToggle(st.id, ex.id)
                  }
                }}
                className={editable ? undefined : 'tap'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  height: 46,
                  marginInline: -10,
                  paddingInline: 10,
                  borderRadius: 12,
                  opacity: isDone && !editable ? 0.4 : 1,
                  background: isActive && !editable ? 'var(--color-volt-tint)' : 'transparent',
                  transition: 'opacity 0.2s ease, background 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: 42,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    letterSpacing: '0.08em',
                    color: isActive && !editable ? 'var(--color-volt)' : 'var(--color-dim)',
                  }}
                >
                  SET {i + 1}
                </div>
                {/* weight — tap to edit; empty space in this cell still toggles the set */}
                <div style={{ flex: 1 }}>
                  {isEditWeight ? (
                    <LoadEditor
                      compact
                      autoFocus
                      value={loadDraft}
                      loadType={loadType}
                      onChange={setLoadDraft}
                      onCommit={() => commitLoad(st)}
                      onCancel={cancelLoad}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isActive && !editable && loadType !== 'free' && (
                        <QuickAdjust label={`Decrease ${ex.name} load`} onClick={(e) => { e.stopPropagation(); void adjustLoad(st, ex, -1) }}>−</QuickAdjust>
                      )}
                      <span
                        className={`display tabular-nums${editMode ? ' tap' : ''}`}
                        onClick={editMode ? (e) => openLoad(e, st, 'weight') : undefined}
                        style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, paddingBottom: 1 }}
                      >
                        {st.weight || '—'}
                      </span>
                      {isActive && !editable && loadType !== 'free' && (
                        <QuickAdjust label={`Increase ${ex.name} load`} onClick={(e) => { e.stopPropagation(); void adjustLoad(st, ex, 1) }}>+</QuickAdjust>
                      )}
                    </div>
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
                      className={`display tabular-nums${editMode ? ' tap' : ''}`}
                      onClick={editMode ? (e) => openLoad(e, st, 'reps') : undefined}
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        lineHeight: 1,
                        color: 'var(--color-sub)',
                        paddingBottom: 1,
                      }}
                    >
                      {st.reps}
                    </span>
                  )}
                </div>
                {editable ? (
                  <button
                    className="tap"
                    aria-label="Remove set"
                    disabled={exSets.length <= 1}
                    onClick={() => removeSet(st.id)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1.5px solid var(--color-check-border)',
                      background: 'transparent',
                      color: 'var(--color-faint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      opacity: exSets.length <= 1 ? 0.3 : 1,
                      cursor: exSets.length <= 1 ? 'default' : 'pointer',
                    }}
                  >
                    <TrashGlyph size={12} />
                  </button>
                ) : (
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
                )}
              </div>
            )
          })}
        </div>

        {/* add-set — only while editing */}
        {editable && (
          <button
            className="tap"
            onClick={() => addSetToSession(session!.id, ex.id)}
            style={{
              marginTop: 6,
              width: '100%',
              height: 38,
              borderRadius: 12,
              border: '1px dashed var(--color-pill-border)',
              background: 'transparent',
              color: 'var(--color-sub)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <PlusGlyph size={12} /> Add set
          </button>
        )}

        {editable && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <label style={settingLabel}>Load step
              <input type="number" inputMode="decimal" value={ex.loadIncrement ?? (loadType === 'plates' || loadType === 'machine' ? 1 : 5)} onChange={(e) => updateExercise(ex.id, { loadIncrement: Math.max(0.5, Number(e.target.value)) })} style={settingField} />
            </label>
            <label style={settingLabel}>Rest seconds
              <input type="number" inputMode="numeric" value={ex.restSeconds ?? 180} onChange={(e) => updateExercise(ex.id, { restSeconds: Math.max(15, Number(e.target.value)) })} style={settingField} />
            </label>
          </div>
        )}
      </div>
    )
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
          padding: `calc(42px + env(safe-area-inset-top)) 20px 12px`,
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div className="display" style={{ fontSize: 27, fontWeight: 700, lineHeight: 1 }}>
            {day.name}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-sub)' }}>
            {day.focus} · {done} of {total} sets
          </div>
        </div>
        {/* Edit toggle — structural editing of the live workout */}
        {editMode && (
          <button
            onClick={() => {
              setNameDraft(null)
              cancelLoad()
              setEditing((v) => !v)
            }}
            className="card tap"
            style={{
              fontSize: 13,
              fontWeight: 640,
              borderRadius: 99,
              borderColor: editing ? 'var(--color-volt)' : 'var(--color-pill-border)',
              color: editing ? 'var(--color-volt)' : 'var(--color-text)',
              background: editing ? 'var(--color-volt-tint)' : undefined,
              padding: '8px 14px',
            }}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
        {/* Total elapsed time for the workout */}
        <div
          className="card display tabular-nums"
          style={{
            fontSize: 18,
            fontWeight: 600,
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
              boxShadow: '0 0 10px rgba(205, 244, 99, 0.55)',
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
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding: '6px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {!editing && activeGroups.length > 1 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {([true, false] as const).map((focused) => (
              <button key={String(focused)} className="tap" onClick={() => setFocusMode(focused)} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid var(--color-pill-border)', background: focusMode === focused ? 'var(--color-volt-tint)' : 'transparent', color: focusMode === focused ? 'var(--color-volt)' : 'var(--color-sub)', fontSize: 12.5, fontWeight: 650 }}>
                {focused ? 'Current exercise' : 'Overview'}
              </button>
            ))}
          </div>
        )}

        {/* Only the unusual modes need explaining — a normal workout doesn't */}
        {(!editMode || editing) && (
          <div style={{ fontSize: 12, color: 'var(--color-faint)', padding: '0 2px' }}>
            {!editMode
              ? 'Viewing a live workout — read only'
              : 'Editing — reorder, rename, change type, and add or remove sets and exercises'}
          </div>
        )}

        {/* Active exercises (not yet fully done) */}
        {visibleActiveGroups.map((g) => renderCard(g, groups.indexOf(g), editing))}

        {/* Add exercise — only while editing */}
        {editing && (
          <button
            className="tap press"
            onClick={onAddExercise}
            style={{
              width: '100%',
              height: 46,
              borderRadius: 16,
              border: '1px dashed var(--color-pill-border)',
              background: 'transparent',
              color: 'var(--color-sub)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 640,
              cursor: 'pointer',
            }}
          >
            <PlusGlyph size={14} /> Add exercise
          </button>
        )}

        {editing && (
          <button className="tap" onClick={() => setConfirmDiscard(true)} style={{ alignSelf: 'center', border: 0, background: 'transparent', color: 'var(--color-red)', padding: '8px 12px', fontSize: 12.5, fontWeight: 650 }}>
            Discard workout
          </button>
        )}

        {/* Done pile — finished exercises drop here; tap to reopen and tweak */}
        {doneGroups.length > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 2px 0',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  color: 'var(--color-faint)',
                }}
              >
                DONE · {doneGroups.length}
              </div>
              <div style={{ flex: 1, height: 1, background: 'var(--color-separator)' }} />
            </div>

            {doneGroups.map((g) =>
              expanded.has(g.ex.id) ? (
                // reopened to tweak — full set rows so you can untick a set
                renderCard(g, groups.indexOf(g), false)
              ) : (
                <div
                  key={g.ex.id}
                  onClick={() => setExpanded((prev) => new Set(prev).add(g.ex.id))}
                  className="card tap"
                  style={{
                    borderRadius: 16,
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
                    {g.ex.name}
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ fontSize: 12, color: 'var(--color-dim)', fontFamily: 'var(--font-mono)' }}
                  >
                    {g.sets.length} {g.sets.length === 1 ? 'set' : 'sets'}
                  </div>
                </div>
              ),
            )}
          </>
        )}
      </div>

      {/* Rest timer — running countdown, or an idle "Start rest" button. Docks
          above the footer; carries the safe-area inset only when no footer follows. */}
      <RestBar
        canStart={editMode && !editing}
        bottomInset={!(done > 0 && editMode && !editing)}
      />

      {/* Footer — just the finish action once any set is done (editors only) */}
      {done > 0 && editMode && !editing && (
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
            onClick={() => setConfirmFinish(true)}
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

      {/* Guard: finishing ends the session and drops any unticked sets */}
      {confirmFinish && (
        <div
          onClick={() => setConfirmFinish(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.62)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: '100%',
              maxWidth: 340,
              borderRadius: 24,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div className="display" style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.05 }}>
              Finish {day.name}?
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--color-sub)', lineHeight: 1.45 }}>
              {done < total
                ? `${done} of ${total} sets done — the ${total - done} unticked ${
                    total - done === 1 ? 'set' : 'sets'
                  } will be dropped from the log.`
                : `All ${total} sets done. Loads carry over to the Library for next time.`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
              <button
                onClick={() => void proceedFinish()}
                style={{
                  height: 50,
                  borderRadius: 25,
                  background: 'var(--color-volt)',
                  color: 'var(--color-on-volt)',
                  border: 'none',
                  fontSize: 15.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Finish workout
              </button>
              <button
                onClick={() => setConfirmFinish(false)}
                style={{
                  height: 50,
                  borderRadius: 25,
                  background: 'transparent',
                  color: 'var(--color-sub)',
                  border: '1px solid var(--color-pill-border)',
                  fontSize: 15.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Keep going
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDiscard && (
        <DiscardDialog title={`Discard ${day.name}?`} body="This removes the unfinished workout and its set changes. Completed history and the plan stay untouched." onCancel={() => setConfirmDiscard(false)} onConfirm={() => void proceedDiscard()} />
      )}
    </div>
  )
}

function QuickAdjust({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      className="tap press"
      aria-label={label}
      onClick={onClick}
      style={{ width: 40, height: 40, flexShrink: 0, marginBlock: -6, borderRadius: 10, border: '1px solid var(--color-pill-border)', background: 'var(--color-card)', color: 'var(--color-text)', fontSize: 19, lineHeight: 1 }}
    >
      {children}
    </button>
  )
}

const settingLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--color-sub)', fontSize: 11 }
const settingField: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 34, borderRadius: 8, border: '1px solid var(--color-pill-border)', background: 'var(--color-bg)', color: 'var(--color-text)', padding: '0 8px', fontSize: 13 }
