import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check, Play } from 'lucide-react'
import { db } from '@/db/db'
import { RUN_DAY_ID } from '@/db/types'
import { startSession, startRun, RESUME_WINDOW_MS } from '@/lib/actions'
import { byDayOrder } from '@/lib/rotation'
import { format, parseISO } from 'date-fns'
import { dateKey } from '@/lib/format'
import {
  DELOAD_NOTE,
  dowLabel,
  dowOf,
  isRest,
  runLine,
  slotDate,
  slotSummary,
  slotOf,
  weekFor,
} from '@/lib/program'
import { hrFlagged, isRun } from '@/lib/session'
import { ExerciseSummary } from '@/components/ExerciseSummary'
import { WeekList } from '@/components/WeekList'
import { SyncBar } from '@/components/SyncBar'
import { ChevronDown } from '@/components/icons'
import { useEditMode } from '@/lib/sync'
import type { Dow, Exercise } from '@/db/types'

/**
 * Home answers exactly one question: what am I doing today.
 *
 * The card says it in words, the week below says it for the other six days, and
 * everything else — bpm ranges, the hard cap, pace, mileage, strides technique —
 * lives on the screen where it gets read, which is /run and /log. Anything here
 * that isn't the answer or the button is competing with them.
 */

/** Volt-tinted card surface for the day you're being asked about. */
const HERO_BACKGROUND =
  'radial-gradient(130% 90% at 15% -10%, rgba(205, 244, 99, 0.13), transparent 55%), var(--color-card)'
/* A volt hairline along the top edge — the card is lit by the accent, not the
   room — plus the soft halo that lifts it off the page. */
const HERO_SHADOW =
  '0 0 60px -24px rgba(205, 244, 99, 0.22), inset 0 1px 0 rgba(205, 244, 99, 0.28)'

/** Warning accent — shared with the rest timer's overrun state. */
const AMBER = '#f5b945'

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.12em',
}

const headlineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 40,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  lineHeight: 1,
}

/** Card-shaped shimmer shown for the blink before the first queries resolve. */
function HeroSkeleton() {
  return (
    <div
      className="card"
      style={{ borderRadius: 30, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div className="skeleton" style={{ width: 110, height: 11, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: '52%', height: 30, borderRadius: 8 }} />
      <div className="skeleton" style={{ width: '68%', height: 14, borderRadius: 6 }} />
      <div className="skeleton" style={{ height: 44, borderRadius: 14, marginTop: 4 }} />
      <div className="skeleton" style={{ height: 52, borderRadius: 26 }} />
    </div>
  )
}

const voltButton: React.CSSProperties = {
  height: 52,
  borderRadius: 26,
  background: 'var(--color-volt)',
  color: 'var(--color-on-volt)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 16,
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  marginTop: 2,
}

const quietButton: React.CSSProperties = {
  ...voltButton,
  background: 'transparent',
  color: 'var(--color-text)',
  border: '1px solid var(--color-pill-border)',
  fontSize: 15,
  height: 48,
  borderRadius: 24,
}

export function Home() {
  const navigate = useNavigate()
  const editMode = useEditMode()
  // Which week we're looking at, and which weekday within it. Both null = today.
  const [viewId, setViewId] = useState<number | null>(null)
  const [selDow, setSelDow] = useState<Dow | null>(null)
  // Which day's exercise list is expanded. Storing the DAY rather than a boolean
  // means switching days collapses it for free — no effect to keep in sync.
  const [openExDow, setOpenExDow] = useState<Dow | null>(null)
  // Set when starting would discard a different session that's still open.
  const [pending, setPending] = useState<'lift' | 'run' | null>(null)

  const days = useLiveQuery(async () => (await db.days.toArray()).sort(byDayOrder), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const weeks = useLiveQuery(
    async () => (await db.programWeeks.toArray()).sort((a, b) => a.id - b.id),
    [],
  )

  // undefined = still loading (show skeleton); [] = loaded but empty
  const ready = days !== undefined && sessions !== undefined && weeks !== undefined
  const dayList = days ?? []
  const sessionList = sessions ?? []
  const weekList = weeks ?? []

  const today = new Date()
  const todayKey = dateKey(today)
  const todayWeek = weekFor(weekList, today)
  // Installed, but the phase hasn't begun yet — fall forward to its first week so
  // Home shows what's coming instead of an empty "nothing scheduled" card, which
  // reads like the install didn't take.
  const nextWeek = todayWeek
    ? null
    : (weekList.find((w) => w.startDate > todayKey) ?? null)
  const week = weekList.find((w) => w.id === viewId) ?? todayWeek ?? nextWeek
  const onTodayWeek = week != null && todayWeek != null && week.id === todayWeek.id
  const notStarted = week != null && nextWeek != null && week.id === nextWeek.id
  const dow: Dow = selDow ?? (onTodayWeek ? dowOf(today) : 'mon')
  const slot = week ? slotOf(week, dow) : undefined
  const run = slot?.run

  const liftDay = dayList.find((d) => d.id === slot?.liftDayId)
  const exercises = useLiveQuery(
    async () => {
      if (!liftDay) return [] as Exercise[]
      return db.exercises.where('dayId').equals(liftDay.id).sortBy('order')
    },
    [liftDay?.id],
    [] as Exercise[],
  )

  const doneDates = new Set(
    sessionList.filter((s) => s.finishedAt != null && !s.deleted).map((s) => s.date),
  )

  // What's already been done on the day we're looking at, so a finished day reads
  // as finished rather than offering the same button it did this morning.
  const selDate = week ? slotDate(week, dow) : todayKey
  const finishedOn = sessionList.filter(
    (s) => s.date === selDate && s.finishedAt != null && !s.deleted,
  )
  const doneRun = finishedOn.find(isRun)
  const doneLift = liftDay
    ? finishedOn.find((s) => !isRun(s) && s.dayId === liftDay.id)
    : undefined

  const showEx = openExDow === dow

  // The one recent, still-open session (if any) — starting something else would
  // discard it, so we confirm first instead of dropping it silently.
  const openSession = sessionList.find(
    (s) => s.finishedAt == null && !s.deleted && Date.now() - s.startedAt < RESUME_WINDOW_MS,
  )
  const openName = openSession
    ? isRun(openSession)
      ? (openSession.run?.label ?? 'run')
      : (dayList.find((d) => d.id === openSession.dayId)?.name ?? 'workout')
    : ''

  const stepWeek = (dir: -1 | 1) => {
    if (!week) return
    const next = weekList.find((w) => w.id === week.id + dir)
    if (!next) return
    setViewId(next.id)
    setSelDow(null)
  }

  function attempt(kind: 'lift' | 'run') {
    const wantsDayId = kind === 'run' ? RUN_DAY_ID : liftDay?.id
    if (openSession && openSession.dayId !== wantsDayId) {
      setPending(kind)
      return
    }
    void proceed(kind)
  }

  async function proceed(kind: 'lift' | 'run') {
    setPending(null)
    if (kind === 'run') {
      if (!week || !slot?.run) return
      const id = await startRun(week, slot)
      if (id) navigate('/run')
      return
    }
    if (!liftDay) return
    const ex = await db.exercises.where('dayId').equals(liftDay.id).sortBy('order')
    await startSession(liftDay, ex, {
      deload: week?.isDeload,
      weekNumber: week?.id,
    })
    navigate('/log')
  }

  // The day, said once. The lift name leads when there is one; a pure run day is
  // named by its own prescription; rest is rest.
  const headline = liftDay?.name ?? slotSummary(slot, null)
  const subline = isRest(slot)
    ? 'Nothing scheduled.'
    : run
      ? liftDay
        ? `then ${runLine(run)}`
        : 'Zone 2'
      : null

  const doneLines: string[] = []
  if (doneLift) doneLines.push(`${liftDay?.name ?? 'Workout'} done`)
  if (doneRun?.run) {
    const r = doneRun.run
    doneLines.push(
      `Run done${r.actualMin != null ? ` · ${r.actualMin} min` : ''}` +
        `${r.actualMi != null ? ` · ${r.actualMi} mi` : ''}`,
    )
  }

  return (
    <div className="screen">
      {/* Title row — sync status and the lock live up here, not in a card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="screen-title" style={{ padding: 0 }}>Workouts</div>
        <SyncBar />
      </div>

      {!ready && <HeroSkeleton />}

      {ready && week && (
        <>
          {/* Which week, and the way out of it */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                ...eyebrowStyle,
                flex: 1,
                color: onTodayWeek ? 'var(--color-volt)' : 'var(--color-sub)',
              }}
            >
              WEEK {week.id} OF {weekList[weekList.length - 1]?.id ?? week.id}
              {!onTodayWeek &&
                (notStarted
                  ? ` · STARTS ${format(parseISO(week.startDate), 'EEE MMM d').toUpperCase()}`
                  : ' · PREVIEW')}
            </div>
            {/* One stepper, two ends — a joined pill rather than two loose dots */}
            <div
              className="card"
              style={{
                display: 'flex',
                borderRadius: 16,
                borderColor: 'var(--color-pill-border)',
                overflow: 'hidden',
              }}
            >
              {([-1, 1] as const).map((dir) => {
                const can = weekList.some((w) => w.id === week.id + dir)
                return (
                  <button
                    key={dir}
                    className="tap"
                    aria-label={dir < 0 ? 'Previous week' : 'Next week'}
                    disabled={!can}
                    onClick={() => stepWeek(dir)}
                    style={{
                      width: 38,
                      height: 30,
                      border: 'none',
                      borderLeft: dir > 0 ? '1px solid var(--color-separator)' : 'none',
                      background: 'transparent',
                      color: can ? 'var(--color-text)' : 'var(--color-future)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: can ? 'pointer' : 'default',
                    }}
                  >
                    {dir < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                )
              })}
            </div>
          </div>

          {week.isDeload && (
            <div
              className="card"
              style={{
                borderRadius: 16,
                padding: '12px 15px',
                borderColor: 'rgba(245,185,69,.28)',
                background: 'rgba(245,185,69,.08)',
                fontSize: 13,
                fontWeight: 600,
                color: AMBER,
              }}
            >
              {DELOAD_NOTE}
            </div>
          )}

          {/* ── The day ─────────────────────────────────────────────────────── */}
          <div
            className="card"
            style={{
              borderRadius: 30,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              background: HERO_BACKGROUND,
              boxShadow: HERO_SHADOW,
            }}
          >
            <div
              style={{
                ...eyebrowStyle,
                color: selDate === todayKey ? 'var(--color-volt)' : 'var(--color-sub)',
              }}
            >
              {selDate === todayKey
                ? `TODAY · ${dowLabel(dow).toUpperCase()}`
                : `${dowLabel(dow).toUpperCase()} · ${format(parseISO(selDate), 'MMM d').toUpperCase()}`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div
                style={{
                  ...headlineStyle,
                  color: isRest(slot) ? 'var(--color-sub)' : 'var(--color-text)',
                }}
              >
                {headline}
              </div>
              {subline && (
                <div style={{ fontSize: 14, color: 'var(--color-sub)', lineHeight: 1.4 }}>
                  {subline}
                  {run?.strides && (
                    <span style={{ color: 'var(--color-volt)' }}> · + strides</span>
                  )}
                </div>
              )}
            </div>

            {/* The plan, one tap away — the answer above shouldn't have to scroll
                past it, but it's still worth a look before you start. */}
            {liftDay && exercises.length > 0 && (
              <div>
                <button
                  onClick={() => setOpenExDow(showEx ? null : dow)}
                  className="tap"
                  aria-expanded={showEx}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: '1px solid var(--color-pill-border)',
                    background: 'transparent',
                    color: 'var(--color-sub)',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {exercises.length} exercises
                  <span style={{ color: 'var(--color-dim)', display: 'flex' }}>
                    <ChevronDown open={showEx} />
                  </span>
                </button>

                {showEx && (
                  <ul style={{ listStyle: 'none', padding: '4px 2px 0', margin: 0 }}>
                    {exercises.map((ex, i) => (
                      <li
                        key={ex.id}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 12,
                          padding: '9px 0',
                          borderTop: i > 0 ? '1px solid var(--color-separator)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                          {ex.name}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--color-dim)',
                            fontFamily: 'var(--font-mono)',
                            textAlign: 'right',
                            flexShrink: 0,
                          }}
                        >
                          <ExerciseSummary ex={ex} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {doneLines.map((line) => (
              <div
                key={line}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 13.5,
                  fontWeight: 620,
                  color: 'var(--color-volt)',
                }}
              >
                <Check size={14} strokeWidth={3} />
                {line}
              </div>
            ))}

            {doneRun?.run && hrFlagged(doneRun.run) && (
              <span
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 11.5,
                  fontWeight: 640,
                  color: AMBER,
                  background: 'rgba(245,185,69,.1)',
                  border: '1px solid rgba(245,185,69,.28)',
                  borderRadius: 20,
                  padding: '3px 9px',
                }}
              >
                Ran {doneRun.run.avgHr} avg · above cap {doneRun.run.hrHardCap}
              </span>
            )}

            {editMode && !isRest(slot) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {liftDay && (
                  <button
                    onClick={() => attempt('lift')}
                    aria-label={`Start ${liftDay.name}`}
                    className="tap press"
                    style={doneLift ? quietButton : voltButton}
                  >
                    <Play size={16} strokeWidth={2.5} fill="currentColor" />
                    Start {liftDay.name}
                  </button>
                )}
                {run && (
                  <button
                    onClick={() => attempt('run')}
                    aria-label={`Start ${run.label}`}
                    className="tap press"
                    style={liftDay || doneRun ? quietButton : voltButton}
                  >
                    <Play size={15} strokeWidth={2.5} fill="currentColor" />
                    Start {liftDay ? 'run' : run.label}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── The rest of the week ────────────────────────────────────────── */}
          <div style={{ ...eyebrowStyle, color: 'var(--color-dim)', marginTop: 2 }}>
            {onTodayWeek ? 'THIS WEEK' : `WEEK ${week.id}`}
          </div>
          <div className="card list-card">
            <WeekList
              week={week}
              days={dayList}
              doneDates={doneDates}
              todayKey={todayKey}
              selected={dow}
              onSelect={(d) => setSelDow(d)}
            />
          </div>
        </>
      )}

      {/* No program week covers today — say so plainly, but don't strand anyone. */}
      {ready && !week && (
        <div
          className="card"
          style={{ borderRadius: 24, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="display" style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.05 }}>
            {weekList.length ? 'No week scheduled' : 'No program yet'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--color-sub)', lineHeight: 1.5 }}>
            {weekList.length
              ? "Today falls outside the program. Re-anchor it in the Library, or just pick a day below."
              : 'Install the base phase from the Library to get the scheduled week. Until then, pick a day.'}
          </div>
          {editMode && dayList.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {dayList
                .filter((d) => !d.archived)
                .map((d) => (
                  <button
                    key={d.id}
                    className="tap press"
                    onClick={async () => {
                      const ex = await db.exercises.where('dayId').equals(d.id).sortBy('order')
                      await startSession(d, ex)
                      navigate('/log')
                    }}
                    style={{
                      flex: '1 1 40%',
                      minWidth: 120,
                      height: 46,
                      borderRadius: 14,
                      border: '1px solid var(--color-pill-border)',
                      background: 'transparent',
                      color: 'var(--color-text)',
                      fontSize: 14,
                      fontWeight: 640,
                      cursor: 'pointer',
                    }}
                  >
                    {d.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Guard: starting something new discards a session still in progress */}
      {pending && (
        <div
          onClick={() => setPending(null)}
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
              Discard the {openName} session?
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--color-sub)', lineHeight: 1.45 }}>
              You have an unfinished {openName} session in progress. Starting this one will
              discard it — this can't be undone.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
              <button
                onClick={() => void proceed(pending)}
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
                Discard &amp; start
              </button>
              <button
                onClick={() => setPending(null)}
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
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
