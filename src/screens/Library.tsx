import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Day, Exercise, LoadType, SetRow } from '@/db/types'
import { ArrowUp, ArrowDown } from 'lucide-react'
import {
  updateDay,
  addDay,
  deleteDay,
  moveDay,
  updateExercise,
  addExercise,
  deleteExercise,
  moveExercise,
} from '@/lib/actions'
import { getSetRows } from '@/lib/format'
import { useEditMode } from '@/lib/sync'
import { byDayOrder } from '@/lib/rotation'
import { inferLoadType, canonicalLoad } from '@/lib/load'
import { ExerciseSummary } from '@/components/ExerciseSummary'
import { LoadEditor, RepsField } from '@/components/LoadEditor'
import { PencilGlyph, PlusGlyph, TrashGlyph, ChevronDown } from '@/components/icons'

/* ── local state shapes ──────────────────────────────────────────────────── */

type DayDraft = { name: string; focus: string }
type ExDraft = { name: string; libLoad: string; loadType: LoadType; rows: SetRow[] }

/** Load-type chips shown in the exercise editor. */
const LOAD_TYPES: { key: LoadType; label: string }[] = [
  { key: 'weight', label: 'Weight' },
  { key: 'machine', label: 'Machine' },
  { key: 'plates', label: 'Plates' },
  { key: 'bodyweight', label: 'Body' },
  { key: 'free', label: 'Other' },
]

function emptyExDraft(ex: Exercise): ExDraft {
  const loadType = ex.loadType ?? inferLoadType(ex.weight)
  return { name: ex.name, libLoad: ex.libLoad, loadType, rows: getSetRows(ex).map((r) => ({ ...r })) }
}

/* ── tiny shared input style ─────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-pill-border)',
  borderRadius: 10,
  color: 'var(--color-text)',
  padding: '8px 10px',
  fontSize: 13.5,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

/** Right-anchored ghost icon button (the pencil/trash affordances). */
const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-faint)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 8,
  padding: 0,
}

/** Form Save / Cancel buttons, shared by the day and exercise inline editors. */
const saveBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--color-volt)',
  color: 'var(--color-on-volt)',
  border: 'none',
  borderRadius: 10,
  padding: '8px 0',
  fontSize: 13,
  fontWeight: 660,
  cursor: 'pointer',
}
const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  color: 'var(--color-sub)',
  border: '1px solid var(--color-pill-border)',
  borderRadius: 10,
  padding: '8px 0',
  fontSize: 13,
  cursor: 'pointer',
}

/** Up/down reorder pair (edit mode). Dimmed + inert at the ends of the list. */
function MoveButtons({
  onMove,
  canUp,
  canDown,
  stopProp = false,
}: {
  onMove: (dir: -1 | 1) => void
  canUp: boolean
  canDown: boolean
  stopProp?: boolean
}) {
  const Btn = (dir: -1 | 1, can: boolean, Icon: typeof ArrowUp) => (
    <button
      className="tap"
      disabled={!can}
      aria-label={dir === -1 ? 'Move up' : 'Move down'}
      onClick={(e) => {
        if (stopProp) e.stopPropagation()
        if (can) onMove(dir)
      }}
      style={{ ...iconBtnStyle, width: 24, opacity: can ? 1 : 0.3, cursor: can ? 'pointer' : 'default' }}
    >
      <Icon size={15} strokeWidth={2.2} />
    </button>
  )
  return (
    <>
      {Btn(-1, canUp, ArrowUp)}
      {Btn(1, canDown, ArrowDown)}
    </>
  )
}

/* ── DayCard ─────────────────────────────────────────────────────────────── */

function DayCard({
  day,
  exercises,
  open,
  onSetOpen,
  editMode,
  isFirst,
  isLast,
  onMoveDay,
}: {
  day: Day
  exercises: Exercise[]
  open: boolean
  onSetOpen: (open: boolean) => void
  editMode: boolean
  isFirst: boolean
  isLast: boolean
  onMoveDay: (dir: -1 | 1) => void
}) {
  // day-level edit
  const [editingDay, setEditingDay] = useState(false)
  const [dayDraft, setDayDraft] = useState<DayDraft>({ name: day.name, focus: day.focus })
  const [confirmDelDay, setConfirmDelDay] = useState(false)

  // exercise-level edit: id of the exercise currently open in the inline editor
  const [editingExId, setEditingExId] = useState<string | null>(null)
  const [exDraft, setExDraft] = useState<ExDraft | null>(null)

  /* day edit handlers */
  function openDayEdit() {
    setDayDraft({ name: day.name, focus: day.focus })
    setConfirmDelDay(false)
    setEditingDay(true)
  }
  async function saveDayEdit() {
    await updateDay(day.id, { name: dayDraft.name.trim() || day.name, focus: dayDraft.focus.trim() })
    setEditingDay(false)
  }
  function cancelDayEdit() {
    setConfirmDelDay(false)
    setEditingDay(false)
  }
  async function handleDeleteDay() {
    await deleteDay(day.id)
  }

  /* exercise edit handlers */
  function openExEdit(ex: Exercise) {
    setEditingExId(ex.id)
    setExDraft(emptyExDraft(ex))
  }
  async function saveExEdit(ex: Exercise) {
    if (!exDraft) return
    const rows = exDraft.rows.map((r) => ({ weight: r.weight.trim(), reps: r.reps.trim() }))
    const safe = rows.length ? rows : [{ weight: '', reps: '' }]
    await updateExercise(ex.id, {
      name: exDraft.name.trim() || ex.name,
      libLoad: exDraft.libLoad.trim(),
      loadType: exDraft.loadType,
      setRows: safe,
      sets: safe.length,
      weight: safe[0].weight,
      reps: safe[0].reps,
    })
    setEditingExId(null)
    setExDraft(null)
  }

  /* switch the exercise's load type, re-canonicalizing each row into it */
  function setLoadType(loadType: LoadType) {
    setExDraft((d) =>
      d
        ? {
            ...d,
            loadType,
            rows: d.rows.map((r) => ({ ...r, weight: canonicalLoad(r.weight, loadType) })),
          }
        : d,
    )
  }

  /* per-set row editing inside the exercise editor */
  function setRow(i: number, field: keyof SetRow, val: string) {
    setExDraft((d) =>
      d ? { ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, [field]: val } : r)) } : d,
    )
  }
  function addRow() {
    setExDraft((d) => {
      if (!d) return d
      const last = d.rows[d.rows.length - 1] ?? { weight: '', reps: '× 6' }
      return { ...d, rows: [...d.rows, { ...last }] }
    })
  }
  function removeRow(i: number) {
    setExDraft((d) =>
      d && d.rows.length > 1 ? { ...d, rows: d.rows.filter((_, j) => j !== i) } : d,
    )
  }
  function cancelExEdit() {
    setEditingExId(null)
    setExDraft(null)
  }

  /* add / delete */
  async function handleAddExercise() {
    const id = await addExercise(day.id)
    // open the freshly-added exercise in edit mode immediately
    const fresh = await db.exercises.get(id)
    if (fresh) {
      onSetOpen(true)
      setEditingExId(id)
      setExDraft(emptyExDraft(fresh))
    }
  }
  async function handleDeleteExercise(id: string) {
    if (editingExId === id) { setEditingExId(null); setExDraft(null) }
    await deleteExercise(id)
  }

  return (
    <div
      className="card"
      style={{ borderRadius: 22, padding: 0, marginBottom: 10 }}
    >
      {/* ── day header ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 18px 14px',
          gap: 8,
          cursor: 'pointer',
        }}
        onClick={() => !editingDay && onSetOpen(!open)}
      >
        {editingDay ? (
          /* day edit form — expands inline in the header row */
          <div
            style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={dayDraft.name}
                onChange={(e) => setDayDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Day name"
                autoFocus
              />
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={dayDraft.focus}
                onChange={(e) => setDayDraft((d) => ({ ...d, focus: e.target.value }))}
                placeholder="Focus"
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveDayEdit} style={saveBtnStyle}>
                Save
              </button>
              <button onClick={cancelDayEdit} style={cancelBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* left: name + focus pill */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 660,
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {day.name}
              </span>
              {day.focus && (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    color: 'var(--color-volt)',
                    background: 'var(--color-volt-tint)',
                    border: '1px solid rgba(205,244,99,.18)',
                    borderRadius: 20,
                    padding: '2px 9px',
                    fontWeight: 540,
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {day.focus}
                </span>
              )}
            </div>
            {/* right: collapse chevron, then edit + delete — pencil/trash stay
                right-anchored so they line up with the exercise rows below */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div
                style={{
                  color: 'var(--color-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                }}
              >
                <ChevronDown open={open} />
              </div>
              {editMode && (
                <>
                  <MoveButtons
                    onMove={onMoveDay}
                    canUp={!isFirst}
                    canDown={!isLast}
                    stopProp
                  />
                  <button
                    className="tap"
                    onClick={(e) => { e.stopPropagation(); openDayEdit() }}
                    style={iconBtnStyle}
                  >
                    <PencilGlyph size={13} />
                  </button>
                  <button
                    className="tap"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelDay(true)
                    }}
                    style={iconBtnStyle}
                  >
                    <TrashGlyph size={13} />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── exercise list (collapsible) ─────────────────────────────────── */}
      {open && (
        <div style={{ paddingBottom: 8 }}>
          {/* separator */}
          <div style={{ height: 1, background: 'var(--color-separator)', marginBottom: 4 }} />

          {exercises.map((ex, idx) => (
            <div key={ex.id}>
              {idx > 0 && (
                <div style={{ height: 1, background: 'var(--color-separator)', margin: '0 18px' }} />
              )}
              {editingExId === ex.id && exDraft ? (
                /* ── inline exercise editor ──────────────────────────── */
                <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Name */}
                  <input
                    style={inputStyle}
                    value={exDraft.name}
                    onChange={(e) => setExDraft((d) => d && ({ ...d, name: e.target.value }))}
                    placeholder="Exercise name"
                    autoFocus
                  />
                  {/* Description — free text shown on the card */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--color-faint)', paddingLeft: 2 }}>Description</span>
                    <input
                      style={inputStyle}
                      value={exDraft.libLoad}
                      onChange={(e) => setExDraft((d) => d && ({ ...d, libLoad: e.target.value }))}
                      placeholder="e.g. Heavy 3–4, top set + back-off"
                    />
                  </div>
                  {/* Load type — how this exercise's weight is entered */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--color-faint)', paddingLeft: 2 }}>Load type</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {LOAD_TYPES.map(({ key, label }) => {
                        const sel = exDraft.loadType === key
                        return (
                          <button
                            key={key}
                            className="tap"
                            onClick={() => setLoadType(key)}
                            style={{
                              height: 30,
                              paddingInline: 12,
                              borderRadius: 15,
                              border: sel
                                ? '1px solid var(--color-volt)'
                                : '1px solid var(--color-pill-border)',
                              background: sel ? 'var(--color-volt-tint)' : 'transparent',
                              color: sel ? 'var(--color-volt)' : 'var(--color-sub)',
                              fontSize: 12.5,
                              fontWeight: sel ? 700 : 500,
                              cursor: 'pointer',
                            }}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Per-set weight + reps */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--color-faint)', paddingLeft: 2 }}>Sets</span>
                    {exDraft.rows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="tabular-nums"
                          style={{ width: 36, fontSize: 11.5, color: 'var(--color-sub)', flexShrink: 0 }}
                        >
                          Set {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <LoadEditor
                            key={exDraft.loadType}
                            value={row.weight}
                            loadType={exDraft.loadType}
                            onChange={(v) => setRow(i, 'weight', v)}
                          />
                        </div>
                        <RepsField value={row.reps} onChange={(v) => setRow(i, 'reps', v)} />
                        <button
                          className="tap"
                          onClick={() => removeRow(i)}
                          disabled={exDraft.rows.length === 1}
                          aria-label={`Remove set ${i + 1}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: exDraft.rows.length === 1 ? 'default' : 'pointer',
                            color: 'var(--color-faint)',
                            opacity: exDraft.rows.length === 1 ? 0.3 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            flexShrink: 0,
                            padding: 0,
                          }}
                        >
                          <TrashGlyph size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="tap"
                      onClick={addRow}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        alignSelf: 'flex-start',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-volt)',
                        fontSize: 12.5,
                        fontWeight: 560,
                        cursor: 'pointer',
                        padding: '2px 2px',
                      }}
                    >
                      <PlusGlyph size={11} />
                      Add set
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => saveExEdit(ex)} style={saveBtnStyle}>
                      Save
                    </button>
                    <button onClick={cancelExEdit} style={cancelBtnStyle}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── read-only exercise row ──────────────────────────── */
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '9px 18px',
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: 'var(--color-d9)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ex.name}
                    </div>
                    {/* In edit mode the controls take the right side, so the load
                        reads on its own line under the name (truncated if long). */}
                    {editMode && (
                      <div
                        className="tabular-nums"
                        style={{
                          marginTop: 2,
                          fontSize: 11.5,
                          color: 'var(--color-sub)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <ExerciseSummary ex={ex} />
                      </div>
                    )}
                  </div>
                  {!editMode && (
                    <div
                      className="tabular-nums"
                      style={{ fontSize: 12.5, color: 'var(--color-sub)', whiteSpace: 'nowrap' }}
                    >
                      <ExerciseSummary ex={ex} />
                    </div>
                  )}
                  {editMode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MoveButtons
                      onMove={(dir) => moveExercise(ex.id, dir)}
                      canUp={idx > 0}
                      canDown={idx < exercises.length - 1}
                    />
                    <button
                      className="tap"
                      onClick={() => openExEdit(ex)}
                      style={iconBtnStyle}
                    >
                      <PencilGlyph size={13} />
                    </button>
                    <button
                      className="tap"
                      onClick={() => handleDeleteExercise(ex.id)}
                      style={iconBtnStyle}
                    >
                      <TrashGlyph size={13} />
                    </button>
                  </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* ── add exercise button ───────────────────────────────────── */}
          {editMode && (
          <div style={{ padding: '6px 18px 4px' }}>
            <button
              className="tap press"
              onClick={handleAddExercise}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: 'var(--color-volt-tint)',
                border: '1px solid rgba(205,244,99,.15)',
                borderRadius: 12,
                padding: '8px 14px',
                color: 'var(--color-volt)',
                fontSize: 13,
                fontWeight: 560,
                cursor: 'pointer',
                width: '100%',
                justifyContent: 'center',
              }}
            >
              <PlusGlyph size={12} />
              Add exercise
            </button>
          </div>
          )}
        </div>
      )}

      {/* Big confirm before deleting a whole day + its exercises */}
      {confirmDelDay && (
        <div
          onClick={() => setConfirmDelDay(false)}
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
            <div style={{ fontSize: 19, fontWeight: 720, letterSpacing: '-0.01em' }}>
              Delete {day.name}?
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--color-sub)', lineHeight: 1.45 }}>
              This permanently removes the day
              {exercises.length
                ? ` and its ${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`
                : ''}
              . This can't be undone.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
              <button
                onClick={handleDeleteDay}
                style={{
                  height: 50,
                  borderRadius: 25,
                  background: '#ff5a5a',
                  color: '#fff',
                  border: 'none',
                  fontSize: 15.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Delete day
              </button>
              <button
                onClick={() => setConfirmDelDay(false)}
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
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Library screen ──────────────────────────────────────────────────────── */

export function Library() {
  const editMode = useEditMode()
  const days = useLiveQuery(async () => (await db.days.toArray()).sort(byDayOrder), [], [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])
  // Accordion: at most one day expanded; null = all collapsed (the default).
  const [openDayId, setOpenDayId] = useState<number | null>(null)

  return (
    <div className="screen">
      <div style={{ padding: '6px 0 18px' }}>
        <div
          className="screen-title"
          style={{ fontSize: 34, fontWeight: 760, letterSpacing: '-0.02em' }}
        >
          Library
        </div>
      </div>

      {days.map((day, i) => {
        const rows = exercises
          .filter((e) => e.dayId === day.id)
          .sort((a, b) => a.order - b.order)
        return (
          <DayCard
            key={day.id}
            day={day}
            exercises={rows}
            open={openDayId === day.id}
            onSetOpen={(o) => setOpenDayId(o ? day.id : null)}
            editMode={editMode}
            isFirst={i === 0}
            isLast={i === days.length - 1}
            onMoveDay={(dir) => moveDay(day.id, dir)}
          />
        )
      })}

      {editMode && (
        <button
          className="tap press"
          onClick={() => addDay()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--color-volt-tint)',
            border: '1px solid rgba(205,244,99,.18)',
            borderRadius: 18,
            padding: '15px 0',
            color: 'var(--color-volt)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            marginTop: 4,
          }}
        >
          <PlusGlyph size={13} />
          Add day
        </button>
      )}
    </div>
  )
}
