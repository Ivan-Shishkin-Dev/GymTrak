import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check, Dumbbell, Footprints, Play } from 'lucide-react'
import { db } from '@/db/db'
import { startSession, RESUME_WINDOW_MS } from '@/lib/actions'
import { byDayOrder } from '@/lib/rotation'
import { format, parseISO } from 'date-fns'
import { dateKey } from '@/lib/format'
import {
  DELOAD_NOTE,
  dowLabel,
  dowOf,
  isRest,
  effortLabel,
  milesLabel,
  slotDate,
  slotOf,
  STRIDES_NOTE,
  weekFor,
  zoneLabel,
} from '@/lib/program'
import { isRun } from '@/lib/session'
import { ExerciseSummary } from '@/components/ExerciseSummary'
import { WeekList } from '@/components/WeekList'
import { SyncBar } from '@/components/SyncBar'
import { ChevronDown } from '@/components/icons'
import { useEditMode } from '@/lib/sync'
import type { Dow, Exercise } from '@/db/types'

/**
 * Home answers exactly one question: what am I doing today.
 *
 * The card answers it in two labelled parts, the lift and the run, and the week
 * below says it for the other six days. A lift is started and logged from here.
 * A run is only ever described: it gets tracked on a watch, not in this app, so
 * its whole prescription is on the card and there is nothing to start.
 */

/** Flat card surface for the day you're being asked about. */
const HERO_BACKGROUND =
  'var(--color-card)'
/* A single accent hairline distinguishes the current selection without a glow. */
const HERO_SHADOW =
  'inset 0 2px 0 rgba(210, 245, 111, 0.58)'

/** Warning accent — shared with the rest timer's overrun state. */
const AMBER = '#f5b945'

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.12em',
}

const headlineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 36,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  lineHeight: 1,
}

/** Card-shaped shimmer shown for the blink before the first queries resolve. */
function HeroSkeleton() {
  return (
    <div
      className="card"
      style={{ borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
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
  borderRadius: 14,
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

/** The small coloured label that opens the lift and the run part of the card. */
function PartLabel({ color, icon, children }: { color: string; icon: React.ReactNode; children: string }) {
  return (
    <div style={{ ...eyebrowStyle, color, display: 'flex', alignItems: 'center', gap: 7 }}>
      {icon}
      {children}
    </div>
  )
}

const quietButton: React.CSSProperties = {
  ...voltButton,
  background: 'transparent',
  color: 'var(--color-text)',
  border: '1px solid var(--color-pill-border)',
  fontSize: 15,
  height: 48,
  borderRadius: 14,
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
  const [pending, setPending] = useState(false)

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

  // Only lifts are logged here, so only a lift can mark a day done.
  const doneDates = new Set(
    sessionList.filter((s) => s.finishedAt != null && !s.deleted && !isRun(s)).map((s) => s.scheduledDate ?? s.date),
  )

  // What's already been done on the day we're looking at, so a finished day reads
  // as finished rather than offering the same button it did this morning.
  const selDate = week ? slotDate(week, dow) : todayKey
  const finishedOn = sessionList.filter(
    (s) => (s.scheduledDate ?? s.date) === selDate && s.finishedAt != null && !s.deleted,
  )
  const doneLift = liftDay
    ? finishedOn.find((s) => !isRun(s) && s.dayId === liftDay.id)
    : undefined

  const showEx = openExDow === dow

  // The one recent, still-open session (if any) — starting something else would
  // discard it, so we confirm first instead of dropping it silently.
  const openSession = sessionList.find(
    (s) => s.finishedAt == null && !s.deleted && !isRun(s) && Date.now() - s.startedAt < RESUME_WINDOW_MS,
  )
  const openName = openSession
    ? (dayList.find((d) => d.id === openSession.dayId)?.name ?? 'workout')
    : ''

  const stepWeek = (dir: -1 | 1) => {
    if (!week) return
    const next = weekList.find((w) => w.id === week.id + dir)
    if (!next) return
    setViewId(next.id)
    setSelDow(null)
  }

  function attempt() {
    if (openSession && (openSession.dayId !== liftDay?.id || (openSession.scheduledDate ?? openSession.date) !== selDate)) {
      setPending(true)
      return
    }
    void proceed()
  }

  async function proceed() {
    setPending(false)
    if (!liftDay) return
    const ex = await db.exercises.where('dayId').equals(liftDay.id).sortBy('order')
    await startSession(liftDay, ex, {
      deload: week?.isDeload,
      weekNumber: week?.id,
      scheduledDate: selDate,
    })
    navigate('/log')
  }

  const doingAnotherDay = selDate !== todayKey
  const liftAction = doneLift
    ? `Repeat ${liftDay?.name ?? 'workout'}`
    : doingAnotherDay
      ? `Do ${liftDay?.name ?? 'workout'} today`
      : `Start ${liftDay?.name ?? 'workout'}`
  // Mileage is only honest at easy pace; a fast session covers more.
  const easyRun = run != null && (run.label === 'Easy Run' || run.label === 'Long Run')

  return (
    <div className="screen">
      {/* Title row — sync status and the lock live up here, not in a card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="screen-title" style={{ padding: 0 }}>Today</div>
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
              borderRadius: 20,
              padding: 20,
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

            {isRest(slot) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ ...headlineStyle, color: 'var(--color-sub)' }}>Rest</div>
                <div style={{ fontSize: 14, color: 'var(--color-sub)', lineHeight: 1.4 }}>
                  Nothing scheduled.
                </div>
              </div>
            )}

            {/* ── Lift: the part you start and log here ── */}
            {liftDay && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <PartLabel color="var(--color-volt)" icon={<Dumbbell size={14} />}>LIFT</PartLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={headlineStyle}>{liftDay.name}</div>
                  {liftDay.focus && (
                    <div style={{ fontSize: 14, color: 'var(--color-sub)', lineHeight: 1.4 }}>
                      {liftDay.focus}
                    </div>
                  )}
                </div>

                {exercises.length > 0 && (
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

                {doneLift && (
                  <div
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
                    {liftDay.name} done
                  </div>
                )}

                {editMode && (
                  <button
                    onClick={attempt}
                    aria-label={`Start ${liftDay.name}`}
                    className="tap press"
                    style={doneLift ? quietButton : voltButton}
                  >
                    <Play size={16} strokeWidth={2.5} fill="currentColor" />
                    {liftAction}
                  </button>
                )}
              </div>
            )}

            {/* ── Run: the plan only. It is tracked on the watch, not here. ── */}
            {run && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  ...(liftDay
                    ? { paddingTop: 16, borderTop: '1px solid var(--color-separator)' }
                    : {}),
                }}
              >
                <PartLabel color="var(--color-run)" icon={<Footprints size={14} />}>
                  {liftDay ? 'RUN · AFTER THE LIFT' : 'RUN'}
                </PartLabel>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div style={liftDay ? { ...headlineStyle, fontSize: 28 } : headlineStyle}>
                    {run.label}
                  </div>
                  <div
                    className="display tabular-nums"
                    style={{ fontSize: liftDay ? 22 : 26, fontWeight: 700, lineHeight: 1, color: 'var(--color-run)' }}
                  >
                    {run.durationMin} min
                  </div>
                </div>
                <div style={{ fontSize: 14, color: 'var(--color-sub)', lineHeight: 1.4 }}>
                  {effortLabel(run.label)} · {zoneLabel(run.hrZoneMin, run.hrZoneMax)} bpm
                  {easyRun && ` · about ${milesLabel(run.durationMin)}`}
                </div>
                {(run.notes || run.strides) && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: 'var(--color-run-tint)',
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {run.notes && <div>{run.notes}</div>}
                    {run.strides && <div>Then {STRIDES_NOTE[0]} {STRIDES_NOTE[1]}</div>}
                  </div>
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
              ? "Today falls outside the program. Re-anchor it in the Plan tab, or just pick a day below."
              : 'Install the run block from the Plan tab to get the scheduled week. Until then, pick a day.'}
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
          onClick={() => setPending(false)}
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
                onClick={() => void proceed()}
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
                onClick={() => setPending(false)}
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
