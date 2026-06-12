import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Day, Exercise } from '@/db/types'
import { updateDay, updateExercise, addExercise, deleteExercise } from '@/lib/actions'
import { PencilGlyph, PlusGlyph, TrashGlyph, ChevronDown } from '@/components/icons'

/* ── local state shapes ──────────────────────────────────────────────────── */

type DayDraft = { name: string; focus: string }
type ExDraft = { name: string; sets: string; libLoad: string; weight: string; reps: string }

function emptyExDraft(ex: Exercise): ExDraft {
  return { name: ex.name, sets: String(ex.sets), libLoad: ex.libLoad, weight: ex.weight, reps: ex.reps }
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

const smallInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: 56,
  textAlign: 'center',
  padding: '8px 6px',
}

/* ── DayCard ─────────────────────────────────────────────────────────────── */

function DayCard({ day, exercises }: { day: Day; exercises: Exercise[] }) {
  const [open, setOpen] = useState(true)

  // day-level edit
  const [editingDay, setEditingDay] = useState(false)
  const [dayDraft, setDayDraft] = useState<DayDraft>({ name: day.name, focus: day.focus })

  // exercise-level edit: id of the exercise currently open in the inline editor
  const [editingExId, setEditingExId] = useState<string | null>(null)
  const [exDraft, setExDraft] = useState<ExDraft | null>(null)

  /* day edit handlers */
  function openDayEdit() {
    setDayDraft({ name: day.name, focus: day.focus })
    setEditingDay(true)
  }
  async function saveDayEdit() {
    await updateDay(day.id, { name: dayDraft.name.trim() || day.name, focus: dayDraft.focus.trim() })
    setEditingDay(false)
  }
  function cancelDayEdit() {
    setEditingDay(false)
  }

  /* exercise edit handlers */
  function openExEdit(ex: Exercise) {
    setEditingExId(ex.id)
    setExDraft(emptyExDraft(ex))
  }
  async function saveExEdit(ex: Exercise) {
    if (!exDraft) return
    const sets = parseInt(exDraft.sets, 10)
    await updateExercise(ex.id, {
      name: exDraft.name.trim() || ex.name,
      sets: isNaN(sets) || sets < 1 ? ex.sets : sets,
      libLoad: exDraft.libLoad.trim(),
      weight: exDraft.weight.trim(),
      reps: exDraft.reps.trim(),
    })
    setEditingExId(null)
    setExDraft(null)
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
      setOpen(true)
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
        onClick={() => !editingDay && setOpen((o) => !o)}
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
              <button
                onClick={saveDayEdit}
                style={{
                  flex: 1,
                  background: 'var(--color-volt)',
                  color: 'var(--color-on-volt)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 0',
                  fontSize: 13,
                  fontWeight: 660,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                onClick={cancelDayEdit}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: 'var(--color-sub)',
                  border: '1px solid var(--color-pill-border)',
                  borderRadius: 10,
                  padding: '8px 0',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* left: name + focus pill */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 660, color: 'var(--color-text)' }}>
                {day.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--color-volt)',
                  background: 'var(--color-volt-tint)',
                  border: '1px solid rgba(205,244,99,.18)',
                  borderRadius: 20,
                  padding: '2px 9px',
                  fontWeight: 540,
                  letterSpacing: '0.01em',
                }}
              >
                {day.focus}
              </span>
            </div>
            {/* right: edit pencil + chevron */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                className="tap"
                onClick={(e) => { e.stopPropagation(); openDayEdit() }}
                style={{
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
                }}
              >
                <PencilGlyph size={13} />
              </button>
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
                <ChevronDown open={open} size={8} />
              </div>
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
                  <input
                    style={inputStyle}
                    value={exDraft.name}
                    onChange={(e) => setExDraft((d) => d && ({ ...d, name: e.target.value }))}
                    placeholder="Exercise name"
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '0 0 auto' }}>
                      <span style={{ fontSize: 10.5, color: 'var(--color-faint)', paddingLeft: 2 }}>Sets</span>
                      <input
                        style={smallInputStyle}
                        type="number"
                        min={1}
                        max={20}
                        value={exDraft.sets}
                        onChange={(e) => setExDraft((d) => d && ({ ...d, sets: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--color-faint)', paddingLeft: 2 }}>Prescription (libLoad)</span>
                      <input
                        style={inputStyle}
                        value={exDraft.libLoad}
                        onChange={(e) => setExDraft((d) => d && ({ ...d, libLoad: e.target.value }))}
                        placeholder="+70 × 6"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--color-faint)', paddingLeft: 2 }}>Weight token</span>
                      <input
                        style={inputStyle}
                        value={exDraft.weight}
                        onChange={(e) => setExDraft((d) => d && ({ ...d, weight: e.target.value }))}
                        placeholder="+70 lb"
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--color-faint)', paddingLeft: 2 }}>Reps token</span>
                      <input
                        style={inputStyle}
                        value={exDraft.reps}
                        onChange={(e) => setExDraft((d) => d && ({ ...d, reps: e.target.value }))}
                        placeholder="× 6"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => saveExEdit(ex)}
                      style={{
                        flex: 1,
                        background: 'var(--color-volt)',
                        color: 'var(--color-on-volt)',
                        border: 'none',
                        borderRadius: 10,
                        padding: '8px 0',
                        fontSize: 13,
                        fontWeight: 660,
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelExEdit}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        color: 'var(--color-sub)',
                        border: '1px solid var(--color-pill-border)',
                        borderRadius: 10,
                        padding: '8px 0',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
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
                  <div style={{ flex: 1, fontSize: 13.5, color: 'var(--color-d9)' }}>
                    {ex.name}
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ fontSize: 12.5, color: 'var(--color-sub)', whiteSpace: 'nowrap' }}
                  >
                    {ex.sets} · {ex.libLoad}
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      className="tap"
                      onClick={() => openExEdit(ex)}
                      style={{
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
                      }}
                    >
                      <PencilGlyph size={12} />
                    </button>
                    <button
                      className="tap"
                      onClick={() => handleDeleteExercise(ex.id)}
                      style={{
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
                      }}
                    >
                      <TrashGlyph size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── add exercise button ───────────────────────────────────── */}
          <div style={{ padding: '6px 18px 4px' }}>
            <button
              className="tap"
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
        </div>
      )}
    </div>
  )
}

/* ── Library screen ──────────────────────────────────────────────────────── */

export function Library() {
  const days = useLiveQuery(() => db.days.orderBy('id').toArray(), [], [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])

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

      {days.map((day) => {
        const rows = exercises
          .filter((e) => e.dayId === day.id)
          .sort((a, b) => a.order - b.order)
        return <DayCard key={day.id} day={day} exercises={rows} />
      })}
    </div>
  )
}
