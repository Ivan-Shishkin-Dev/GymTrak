import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/db'
import { finishRun } from '@/lib/actions'
import { fmtClock } from '@/lib/format'
import {
  milesLabel,
  paceLabel,
  pacePerMile,
  STRIDES_NOTE,
  zoneLabel,
} from '@/lib/program'
import { isRun } from '@/lib/session'
import { useEditMode } from '@/lib/sync'
import { ProgressRing } from '@/components/ProgressRing'
import { BackChevron } from '@/components/icons'

/**
 * The live run screen. A run has no sets — the whole session is a clock against a
 * prescribed duration — so it gets its own screen rather than branching /log,
 * which is built end to end around set rows.
 *
 * Average HR is asked for at finish, when the watch is still in your hand. It's
 * optional: a run with no reading is still a run, and a reading over the hard cap
 * flags the session without ever blocking the save.
 */

const AMBER = '#f5b945'

const fieldStyle: React.CSSProperties = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-pill-border)',
  borderRadius: 12,
  color: 'var(--color-text)',
  fontSize: 17,
  fontWeight: 660,
  padding: '11px 12px',
  outline: 'none',
  width: '100%',
  textAlign: 'center',
}

export function Run() {
  const navigate = useNavigate()
  const editMode = useEditMode()
  const [now, setNow] = useState(() => Date.now())
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [hr, setHr] = useState('')
  const [mins, setMins] = useState('')
  const [miles, setMiles] = useState('')

  const open = useLiveQuery(
    () => db.sessions.filter((s) => s.finishedAt == null && !s.deleted).toArray(),
    [],
  )
  const session = open?.find(isRun)
  const openLift = open?.find((s) => !isRun(s))

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // No open run (opened /run directly, or just finished) → leave. If a lift is
  // what's actually running, hand over to /log rather than dropping Home.
  useEffect(() => {
    if (open === undefined || session) return
    navigate(openLift ? '/log' : '/', { replace: true })
  }, [open, session, openLift, navigate])

  if (!session?.run) return null

  const run = session.run
  const elapsed = Math.floor((now - session.startedAt) / 1000)
  const planned = run.plannedMin * 60
  const pct = planned > 0 ? (elapsed / planned) * 100 : 0
  const over = elapsed >= planned

  const num = (v: string): number | null => {
    const n = v.trim() === '' ? NaN : Number(v)
    return Number.isFinite(n) ? n : null
  }
  const hrNum = num(hr)
  const minNum = num(mins)
  const miNum = num(miles)
  const overCap = hrNum != null && hrNum > run.hrHardCap
  // Only meaningful once both halves are in — this is the reading that tells you
  // whether ZONE2_REFERENCE still matches what your legs actually do.
  const achieved = pacePerMile(minNum, miNum)

  function openFinish() {
    setMins(String(Math.max(1, Math.round(elapsed / 60))))
    // Distance starts blank on purpose: prefilling the planned estimate would
    // feed the app's own guess back in as if it were a measurement.
    setMiles(run.actualMi != null ? String(run.actualMi) : '')
    setHr(run.avgHr != null ? String(run.avgHr) : '')
    setConfirmFinish(true)
  }

  async function proceedFinish() {
    await finishRun(session!.id, {
      actualMin: minNum,
      actualMi: miNum,
      avgHr: hrNum,
    })
    setConfirmFinish(false)
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {run.label}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-sub)' }}>
            {session.weekNumber ? `Week ${session.weekNumber} · ` : ''}
            Zone 2 · {zoneLabel(run.hrZoneMin, run.hrZoneMax)}
          </div>
        </div>
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

      {/* Body */}
      <div className="screen-scroll" style={{ flex: 1 }}>
        <div
          style={{
            padding: '18px 20px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 22,
          }}
        >
          <ProgressRing
            pct={pct}
            size={200}
            inner={178}
            color={over ? AMBER : 'var(--color-volt)'}
            glow
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <div
                className="tabular-nums"
                style={{ fontSize: 40, fontWeight: 760, letterSpacing: '-0.02em' }}
              >
                {fmtClock(elapsed)}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--color-sub)' }}>
                of {run.plannedMin} min · ≈ {milesLabel(run.plannedMin)}
              </div>
            </div>
          </ProgressRing>

          <div
            className="card"
            style={{
              width: '100%',
              borderRadius: 22,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--color-sub)' }}>Duration</span>
              <span style={{ fontWeight: 660 }}>{run.plannedMin} min</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--color-sub)' }}>Distance</span>
              <span style={{ fontWeight: 660 }}>
                ≈ {milesLabel(run.plannedMin)}
                <span style={{ color: 'var(--color-dim)', fontWeight: 500 }}>
                  {' '}at {paceLabel()}
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--color-sub)' }}>Heart rate</span>
              <span style={{ fontWeight: 660 }}>
                {zoneLabel(run.hrZoneMin, run.hrZoneMax)} bpm
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--color-sub)' }}>Hard cap</span>
              <span style={{ fontWeight: 660, color: AMBER }}>{run.hrHardCap} bpm</span>
            </div>

            {run.strides && (
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 12,
                  borderTop: '1px solid var(--color-separator)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    color: 'var(--color-faint)',
                    marginBottom: 6,
                  }}
                >
                  STRIDES
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-sub)', lineHeight: 1.55 }}>
                  {STRIDES_NOTE.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer — a run can always be finished; there's no set count to gate on */}
      {editMode && (
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
            onClick={openFinish}
            className="tap press"
            style={{
              width: '100%',
              height: 52,
              borderRadius: 26,
              background: 'var(--color-volt)',
              color: 'var(--color-on-volt)',
              fontSize: 16,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Finish run
          </button>
        </div>
      )}

      {/* Finish — where the watch reading gets recorded. Both fields optional. */}
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
            <div style={{ fontSize: 19, fontWeight: 720, letterSpacing: '-0.01em' }}>
              Finish {run.label}?
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--color-sub)', lineHeight: 1.45 }}>
              Add what your watch says, or leave it blank — the run saves either way.
              Miles is what keeps the {paceLabel()} estimate honest.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: 'var(--color-sub)', fontWeight: 600 }}>
                  Minutes
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={mins}
                  onChange={(e) => setMins(e.target.value)}
                  style={fieldStyle}
                />
              </label>
              <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: 'var(--color-sub)', fontWeight: 600 }}>
                  Miles
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={miles}
                  onChange={(e) => setMiles(e.target.value)}
                  style={fieldStyle}
                />
              </label>
              <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: 'var(--color-sub)', fontWeight: 600 }}>
                  Avg HR
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={hr}
                  onChange={(e) => setHr(e.target.value)}
                  style={{
                    ...fieldStyle,
                    borderColor: overCap ? AMBER : 'var(--color-pill-border)',
                    color: overCap ? AMBER : 'var(--color-text)',
                  }}
                />
              </label>
            </div>

            {achieved != null && (
              <span
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 11.5,
                  fontWeight: 640,
                  color: 'var(--color-sub)',
                }}
              >
                {paceLabel(achieved)} · plan assumes {paceLabel()}
              </span>
            )}

            {overCap && (
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
                Above cap · {run.hrHardCap}
              </span>
            )}

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
                Finish run
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
    </div>
  )
}
