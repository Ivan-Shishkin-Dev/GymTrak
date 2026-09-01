import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, format, isMonday, nextMonday, parseISO } from 'date-fns'
import { db } from '@/db/db'
import { dateKey } from '@/lib/format'
import { milesLabel, paceLabel, weekFor, weekMinutes } from '@/lib/program'
import {
  BASE_FIRST_WEEK,
  BASE_LAST_WEEK,
  installBasePhase,
  setProgramStart,
} from '@/db/program'
import { ChevronDown } from '@/components/icons'
import type { ProgramWeek } from '@/db/types'

/**
 * The running program, surfaced in the Library.
 *
 * This is also where the Base Phase gets installed and where the two destructive
 * migrations live — archiving the legacy six-day split and removing the generic
 * Cardio line item. Both sit behind the same full-screen confirm the Library uses
 * for deleting a day, because neither is something you want on a mis-tap.
 */

/**
 * The Monday to start on. `nextMonday` is strictly future, so on a Monday it
 * would skip a whole week — if you're installing the program that morning, that
 * Monday is the one you mean.
 */
function upcomingMonday(now: Date): Date {
  return isMonday(now) ? now : nextMonday(now)
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-pill-border)',
  borderRadius: 12,
  color: 'var(--color-text)',
  fontSize: 14,
  fontWeight: 600,
  padding: '10px 12px',
  outline: 'none',
  width: '100%',
}

const actionStyle = (kind: 'volt' | 'danger' | 'quiet'): React.CSSProperties => ({
  height: 46,
  borderRadius: 23,
  fontSize: 14.5,
  fontWeight: 680,
  cursor: 'pointer',
  border:
    kind === 'quiet' ? '1px solid var(--color-pill-border)' : '1px solid transparent',
  background:
    kind === 'volt' ? 'var(--color-volt)' : kind === 'danger' ? '#ff5a5a' : 'transparent',
  color:
    kind === 'volt'
      ? 'var(--color-on-volt)'
      : kind === 'danger'
        ? '#fff'
        : 'var(--color-sub)',
})

/** The Library's full-screen confirm, lifted so both destructive steps share it. */
function Confirm({
  title,
  body,
  action,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  action: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      onClick={onCancel}
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
          {title}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--color-sub)', lineHeight: 1.45 }}>
          {body}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          <button onClick={onConfirm} style={{ ...actionStyle('danger'), height: 50, borderRadius: 25 }}>
            {action}
          </button>
          <button onClick={onCancel} style={{ ...actionStyle('quiet'), height: 50, borderRadius: 25 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

/** '30/35/25/55' — the week's run minutes, Mon/Wed/Thu/Sat. */
function runMinutes(w: ProgramWeek): string {
  return (['mon', 'wed', 'thu', 'sat'] as const)
    .map((d) => w.slots.find((s) => s.dow === d)?.run?.durationMin ?? 0)
    .join('/')
}

/** 'Aug 31 – Sep 6' */
function weekRange(w: ProgramWeek): string {
  const start = parseISO(w.startDate)
  return `${format(start, 'MMM d')} – ${format(addDays(start, 6), 'MMM d')}`
}

export function ProgramCard({
  editMode,
  editing,
}: {
  editMode: boolean
  editing: boolean
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<'archive' | 'cardio' | null>(null)
  const [busy, setBusy] = useState(false)

  const weeks = useLiveQuery(
    async () => (await db.programWeeks.toArray()).sort((a, b) => a.id - b.id),
    [],
    [],
  )
  // Slug-less, unarchived days are the legacy split — what "archive the old six"
  // acts on. Counting them here keeps the confirm copy honest.
  const legacyCount = useLiveQuery(
    async () => (await db.days.toArray()).filter((d) => !d.slug && !d.archived).length,
    [],
    0,
  )
  const cardioCount = useLiveQuery(
    async () =>
      (await db.exercises.toArray()).filter((e) => /^\s*cardio\b/i.test(e.name)).length,
    [],
    0,
  )

  // Derived, not stored: the phase is prescribed in minutes, and mileage is what
  // those minutes come to at the current Zone 2 pace.
  const phaseTotal = weeks.reduce((t, w) => t + weekMinutes(w), 0)

  const installed = weeks.length > 0
  // What the collapsed row says. "Weeks 9–16" is true but inert; where you are in
  // them is the thing worth reading without opening the card.
  const current = weekFor(weeks, new Date())
  const status = !installed
    ? 'Not installed'
    : current
      ? `Week ${current.id} of ${weeks[weeks.length - 1].id} · this week`
      : weeks[0].startDate > dateKey(new Date())
        ? `Starts ${format(parseISO(weeks[0].startDate), 'EEE MMM d')}`
        : `Weeks ${weeks[0].id}–${weeks[weeks.length - 1].id} · finished`
  const [startDraft, setStartDraft] = useState<string | null>(null)
  const anchor = weeks[0]?.startDate ?? dateKey(upcomingMonday(new Date()))
  const start = startDraft ?? anchor

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <div className="card" style={{ borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="tap"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '15px 16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Program
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-sub)', marginTop: 2 }}>
            {status}
          </div>
        </div>
        <ChevronDown open={open} />
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {installed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {weeks.map((w) => (
                <div
                  key={w.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderTop: '1px solid var(--color-separator)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontWeight: 700, minWidth: 40 }}>WK {w.id}</span>
                      <span style={{ color: 'var(--color-sub)' }}>{weekRange(w)}</span>
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        marginLeft: 48,
                        fontSize: 12,
                        color: 'var(--color-faint)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {runMinutes(w)} min · {milesLabel(weekMinutes(w))}
                    </div>
                  </div>
                  {w.isDeload && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        color: 'var(--color-volt)',
                        background: 'var(--color-volt-tint)',
                        border: '1px solid rgba(205,244,99,.18)',
                        borderRadius: 20,
                        padding: '2px 7px',
                      }}
                    >
                      DELOAD
                    </span>
                  )}
                </div>
              ))}
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--color-dim)',
                  marginTop: 8,
                  lineHeight: 1.5,
                }}
              >
                Minutes are Mon/Wed/Thu/Sat · miles at {paceLabel()} ·{' '}
                {milesLabel(phaseTotal)} total
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--color-sub)', lineHeight: 1.5 }}>
              The base phase adds eight scheduled weeks of Zone 2 running alongside
              four consolidated lift days. Nothing is removed until you say so.
            </div>
          )}

          {editMode && editing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <label style={{ fontSize: 11.5, color: 'var(--color-sub)', fontWeight: 600 }}>
                Week {BASE_FIRST_WEEK} starts (Monday)
              </label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStartDraft(e.target.value)}
                style={inputStyle}
              />

              {!installed ? (
                <button
                  disabled={busy}
                  onClick={() => run(() => installBasePhase({ startMonday: start }))}
                  style={actionStyle('volt')}
                >
                  Install base phase
                </button>
              ) : (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await installBasePhase({ startMonday: start })
                        if (start !== anchor) await setProgramStart(start)
                      })
                    }
                    style={actionStyle('volt')}
                  >
                    {start !== anchor ? 'Re-anchor program' : 'Refresh templates'}
                  </button>
                  <button
                    disabled={busy || legacyCount === 0}
                    onClick={() => setConfirm('archive')}
                    style={{
                      ...actionStyle('quiet'),
                      opacity: legacyCount === 0 ? 0.4 : 1,
                    }}
                  >
                    Archive the old split ({legacyCount})
                  </button>
                  <button
                    disabled={busy || cardioCount === 0}
                    onClick={() => setConfirm('cardio')}
                    style={{
                      ...actionStyle('quiet'),
                      opacity: cardioCount === 0 ? 0.4 : 1,
                    }}
                  >
                    Remove Cardio line items ({cardioCount})
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {confirm === 'archive' && (
        <Confirm
          title="Archive the old split?"
          body={`Hides ${legacyCount} day${legacyCount === 1 ? '' : 's'} from the Library. Nothing is deleted — past workouts keep working, and you can unarchive from the Archived section.`}
          action="Archive"
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            run(() => installBasePhase({ startMonday: start, archiveLegacy: true }))
          }
        />
      )}
      {confirm === 'cardio' && (
        <Confirm
          title="Remove Cardio?"
          body={`Permanently deletes ${cardioCount} Cardio exercise${cardioCount === 1 ? '' : 's'} from the library. Finished workouts keep the cardio they already logged. This can't be undone.`}
          action="Remove Cardio"
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            run(() => installBasePhase({ startMonday: start, removeCardio: true }))
          }
        />
      )}
    </div>
  )
}

