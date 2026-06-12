import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { db } from '@/db/db'
import { startSession, addNote, deleteNote } from '@/lib/actions'
import { dayOfRotationLabel, nextInCycle } from '@/lib/rotation'
import { ProgressRing } from '@/components/ProgressRing'
import type { Exercise, Note } from '@/db/types'

export function Home() {
  const navigate = useNavigate()
  const [overrideId, setOverrideId] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const days = useLiveQuery(() => db.days.orderBy('id').toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const notes = useLiveQuery(
    () => db.notes.orderBy('createdAt').reverse().toArray(),
    [],
    [] as Note[],
  )

  const autoPicked = nextInCycle(days, sessions)
  const day =
    overrideId != null
      ? (days.find((d) => d.id === overrideId) ?? autoPicked)
      : autoPicked

  const exercises = useLiveQuery(
    async () => {
      if (!day) return [] as Exercise[]
      return db.exercises.where('dayId').equals(day.id).sortBy('order')
    },
    [day?.id],
    [] as Exercise[],
  )

  const ringPct = day ? Math.round((day.id / 6) * 100) : 0
  const visibleNotes = (notes ?? []).filter((n) => !n.deleted)

  async function start() {
    if (!day) return
    const ex = await db.exercises.where('dayId').equals(day.id).sortBy('order')
    await startSession(day, ex)
    navigate('/log')
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    await addNote(noteText)
    setNoteText('')
    inputRef.current?.focus()
  }

  function handleNoteKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAddNote()
  }

  return (
    <div className="screen">
      <div className="screen-title">Workouts</div>

      {/* ── Day picker ─────────────────────────────────────────────────── */}
      {days.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 4,
          }}
        >
          {days.map((d) => {
            const isSelected =
              overrideId != null ? d.id === overrideId : d.id === autoPicked?.id
            return (
              <button
                key={d.id}
                className="tap"
                onClick={() => setOverrideId(d.id === autoPicked?.id ? null : d.id)}
                style={{
                  height: 34,
                  minWidth: 34,
                  paddingInline: 12,
                  borderRadius: 17,
                  border: isSelected
                    ? '1px solid var(--color-volt)'
                    : '1px solid var(--color-pill-border)',
                  background: isSelected ? 'var(--color-volt-tint)' : 'transparent',
                  color: isSelected ? 'var(--color-volt)' : 'var(--color-sub)',
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em',
                  transition: 'all 0.15s ease',
                }}
              >
                {d.id}
              </button>
            )
          })}
          <span
            style={{
              alignSelf: 'center',
              fontSize: 11,
              color: 'var(--color-dim)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              marginLeft: 2,
            }}
          >
            PICK DAY
          </span>
        </div>
      )}

      {/* ── Hero card ──────────────────────────────────────────────────── */}
      {day && (
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

          {/* name + ring row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
            <ProgressRing pct={ringPct}>
              <span style={{ fontSize: 22, fontWeight: 680 }}>{day.id}</span>
            </ProgressRing>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div
                style={{
                  fontSize: 27,
                  fontWeight: 740,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text)',
                  lineHeight: 1.1,
                }}
              >
                {day.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-sub)' }}>
                {day.focus}
              </div>
            </div>
          </div>

          {/* bulleted exercise list */}
          {exercises.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {exercises.map((ex) => (
                <li
                  key={ex.id}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--color-volt)',
                      flexShrink: 0,
                      marginTop: 2,
                      alignSelf: 'center',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--color-text)',
                      lineHeight: 1.35,
                    }}
                  >
                    {ex.name}
                  </span>
                  {ex.libLoad && (
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--color-dim)',
                        fontFamily: 'var(--font-mono)',
                        marginLeft: 'auto',
                        flexShrink: 0,
                      }}
                    >
                      {ex.libLoad}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={start}
            aria-label="Start workout"
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
              cursor: 'pointer',
            }}
          >
            Start workout
          </button>
        </div>
      )}

      {/* ── Notes card ─────────────────────────────────────────────────── */}
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
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--color-sub)',
          }}
        >
          NOTES
        </div>

        {/* input row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            placeholder="Add a note…"
            style={{
              flex: 1,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-pill-border)',
              borderRadius: 14,
              color: 'var(--color-text)',
              padding: '11px 14px',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            className="tap"
            onClick={handleAddNote}
            disabled={!noteText.trim()}
            style={{
              height: 40,
              paddingInline: 16,
              borderRadius: 20,
              background: noteText.trim() ? 'var(--color-volt)' : 'var(--color-card-border)',
              color: noteText.trim() ? 'var(--color-on-volt)' : 'var(--color-dim)',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: noteText.trim() ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            Add
          </button>
        </div>

        {/* note list */}
        {visibleNotes.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {visibleNotes.map((note, i) => (
              <div
                key={note.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  paddingBlock: 12,
                  borderTop:
                    i === 0 ? '1px solid var(--color-separator)' : undefined,
                  borderBottom: '1px solid var(--color-separator)',
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--color-text)',
                      lineHeight: 1.4,
                    }}
                  >
                    {note.text}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-dim)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {format(new Date(note.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
                <button
                  className="tap"
                  onClick={() => deleteNote(note.id)}
                  aria-label="Delete note"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-faint)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    fontSize: 16,
                    lineHeight: 1,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {visibleNotes.length === 0 && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-dim)',
              textAlign: 'center',
              paddingBlock: 8,
            }}
          >
            No notes yet
          </div>
        )}
      </div>
    </div>
  )
}
