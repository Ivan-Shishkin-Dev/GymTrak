import { useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import { Timer } from 'lucide-react'
import { ProgressRing } from './ProgressRing'
import { fmtClock } from '@/lib/format'
import {
  useRestTimer,
  remainingSec,
  addTime,
  setDefault,
  startRest,
  stopRest,
} from '@/lib/restTimer'

const PRESETS = [60, 90, 120, 180]
const AMBER = '#f5b945'
const RED = '#ff5a5a'
const OVERRUN_STOP = -300 // give up 5 min into overrun so a forgotten timer clears

/**
 * The docked rest-timer bar: a depleting volt ring + live controls. Auto-starts
 * when a set is ticked done (Log's onToggle). When the clock passes zero it
 * doesn't vanish — it flips to a red count-up so you can see how far past target
 * you've rested. Rendered above the tab bar (Home/Library) and above the Log
 * footer (/log); both read the one global store, so they stay in lockstep.
 *
 * `canStart` adds an idle "Start rest" button when nothing is running, so the
 * timer can be used on demand (not only after ticking a set) — passed by the Log
 * screen. `bottomInset` adds the home-indicator inset when this bar is the
 * bottom-most element (no Finish footer / tab bar below it).
 */
export function RestBar({
  canStart = false,
  bottomInset = false,
}: {
  canStart?: boolean
  bottomInset?: boolean
} = {}) {
  const state = useRestTimer()
  const [, tick] = useReducer((n) => n + 1, 0)

  // Re-render ~4×/sec while resting so the ring + clock stay live. Timestamp math
  // (not a counter) keeps a throttled background tab correct. Re-arm when the
  // target shifts (±15 / preset) so the overrun check reads current values.
  useEffect(() => {
    if (!state.active) return
    const id = setInterval(() => {
      if (remainingSec(state, Date.now()) < OVERRUN_STOP) stopRest()
      else tick()
    }, 250)
    return () => clearInterval(id)
  }, [state.active, state.startedAt, state.targetSec])

  const padBottom = bottomInset
    ? 'calc(12px + env(safe-area-inset-bottom))'
    : '12px'

  // Idle: offer a one-tap "Start rest" at the current default (Log only).
  if (!state.active) {
    if (!canStart) return null
    return (
      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid var(--color-card-border)',
          background: 'rgba(10,10,11,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: `10px 20px ${padBottom}`,
        }}
      >
        <button
          className="tap press"
          onClick={startRest}
          style={{
            width: '100%',
            height: 42,
            borderRadius: 21,
            border: '1px solid var(--color-pill-border)',
            background: 'transparent',
            color: 'var(--color-sub)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 620,
            cursor: 'pointer',
          }}
        >
          <Timer size={16} strokeWidth={2.2} /> Start rest · {fmtClock(state.defaultSec)}
        </button>
      </div>
    )
  }

  const remaining = remainingSec(state, Date.now())
  const overrun = remaining < 0
  const pct = overrun
    ? 100
    : Math.max(0, Math.min(100, (remaining / state.targetSec) * 100))
  const ringColor = overrun ? RED : remaining <= 10 ? AMBER : 'var(--color-volt)'
  const label = overrun ? `+${fmtClock(-remaining)}` : fmtClock(remaining)

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--color-card-border)',
        background: 'rgba(10,10,11,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: `12px 20px ${padBottom}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'sheet-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      {/* main row: ring + time + adjust + skip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ProgressRing
          pct={pct}
          size={44}
          inner={36}
          color={ringColor}
          glow={!overrun && remaining > 10}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              letterSpacing: '0.14em',
              color: overrun ? RED : 'var(--color-sub)',
            }}
          >
            {overrun ? 'OVER REST' : 'RESTING'}
          </div>
          <div
            className="display tabular-nums"
            style={{
              fontSize: 27,
              fontWeight: 700,
              lineHeight: 1.05,
              color: overrun ? RED : 'var(--color-text)',
            }}
          >
            {label}
          </div>
        </div>
        <Btn onClick={() => addTime(-15)}>−15</Btn>
        <Btn onClick={() => addTime(15)}>+15</Btn>
        <Btn volt onClick={stopRest}>
          Skip
        </Btn>
      </div>

      {/* preset row: sets the default (persisted) and retargets the running rest */}
      <div style={{ display: 'flex', gap: 6 }}>
        {PRESETS.map((sec) => {
          const active = state.defaultSec === sec
          return (
            <button
              key={sec}
              className="tap"
              onClick={() => setDefault(sec)}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 14,
                border: active
                  ? '1px solid var(--color-volt)'
                  : '1px solid var(--color-pill-border)',
                background: active ? 'var(--color-volt-tint)' : 'transparent',
                color: active ? 'var(--color-volt)' : 'var(--color-sub)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 620,
                cursor: 'pointer',
              }}
            >
              {fmtClock(sec)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Pill button matching the house style — volt = primary, ghost = bordered. */
function Btn({
  children,
  onClick,
  volt,
}: {
  children: ReactNode
  onClick: () => void
  volt?: boolean
}) {
  return (
    <button
      className="tap press"
      onClick={onClick}
      style={{
        height: 38,
        minWidth: volt ? 58 : 46,
        padding: '0 12px',
        borderRadius: 19,
        border: volt ? 'none' : '1px solid var(--color-pill-border)',
        background: volt ? 'var(--color-volt)' : 'transparent',
        color: volt ? 'var(--color-on-volt)' : 'var(--color-text)',
        fontSize: 14,
        fontWeight: volt ? 700 : 620,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}
