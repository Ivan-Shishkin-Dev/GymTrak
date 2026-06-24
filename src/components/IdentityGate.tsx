import { useEffect, useRef, useState } from 'react'
import { Lock, LockOpen, KeyRound, Eye, Delete } from 'lucide-react'
import {
  useSyncState,
  enterEditMode,
  closeEditPrompt,
  openEditPrompt,
} from '@/lib/sync'

// The edit code is a fixed-length numeric passcode (the bcrypt-hashed value lives
// in Supabase's `app_secret`). Filling the last digit auto-submits, iOS-style.
const CODE_LENGTH = 4

/**
 * Front door to the log. On every fresh load it asks "Are you Ivan?" — anyone can
 * step past it and keep reading (the whole log is public), but turning on editing
 * needs the key (password). Mounted once at the app root, over the blurred app.
 *
 * The lock-dial ring is the through-line: it shows the log is closed to edits, and
 * springs open the instant the right key lands — the one moment Ivan sees on the
 * way into every session.
 */
export function IdentityGate() {
  const state = useSyncState()
  const [step, setStep] = useState<'ask' | 'password'>('ask')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Holds the modal open for the unlock flourish after edit mode is already on.
  const [unlocked, setUnlocked] = useState(false)

  // Ask once on first load when not already unlocked (and sync is configured).
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    if (state.configured && !state.editMode) openEditPrompt()
  }, [state.configured, state.editMode])

  // Reset to the question whenever the modal (re)opens; focus the field on step 2.
  useEffect(() => {
    if (state.promptOpen) {
      setStep('ask')
      setPw('')
      setErr(null)
      setUnlocked(false)
    }
  }, [state.promptOpen])

  // After the unlock flourish plays, let the modal fall away.
  useEffect(() => {
    if (!unlocked) return
    const t = setTimeout(() => setUnlocked(false), 760)
    return () => clearTimeout(t)
  }, [unlocked])

  const visible = unlocked || (state.promptOpen && !state.editMode)

  // Verify a complete code. Takes the just-typed value so it never races state.
  async function submit(code: string) {
    if (busy) return
    setBusy(true)
    setErr(null)
    const res = await enterEditMode(code)
    if (res.ok) {
      setUnlocked(true) // editMode is on; keep the card up for the flourish
      return
    }
    setBusy(false)
    setErr(res.error ?? 'That code doesn’t fit.')
    setPw('')
  }

  function pressDigit(d: string) {
    if (busy || pw.length >= CODE_LENGTH) return
    setErr(null)
    const next = pw + d
    setPw(next)
    if (next.length === CODE_LENGTH) void submit(next) // last digit unlocks
  }

  function pressBackspace() {
    if (busy || !pw) return
    setErr(null)
    setPw(pw.slice(0, -1))
  }

  // Esc steps back (password → ask) or dismisses into read-only.
  useEffect(() => {
    if (!visible || unlocked) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (step === 'password') setStep('ask')
      else closeEditPrompt()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, unlocked, step])

  // Physical keyboard on desktop: digits fill the code, Backspace deletes one.
  useEffect(() => {
    if (!visible || unlocked || step !== 'password') return
    function onKey(e: KeyboardEvent) {
      if (e.key.length === 1 && e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        pressDigit(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        pressBackspace()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // pressDigit/pressBackspace close over pw/busy → re-bind when they change.
  }, [visible, unlocked, step, pw, busy])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background:
          'radial-gradient(120% 80% at 50% -10%, rgba(205,244,99,0.10), transparent 55%), rgba(0,0,0,0.70)',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'gate-overlay-in 0.3s ease both',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        className="card"
        style={{
          width: '100%',
          maxWidth: 352,
          borderRadius: 28,
          padding: '32px 26px 26px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'gate-card-in 0.42s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <LockDial open={unlocked} />

        {unlocked ? (
          <Section
            eyebrow="UNLOCKED"
            title="You’re in"
            titleId="gate-title"
            body="Editing is on. Changes save to the cloud as you go."
          />
        ) : step === 'ask' ? (
          <>
            <Section
              eyebrow="IVAN’S TRAINING LOG"
              title="Are you Ivan?"
              titleId="gate-title"
              body="The whole log is open to read. Editing the plan or logging a set needs your key."
            />
            <div style={stackStyle}>
              <GateButton variant="volt" icon={<KeyRound size={17} strokeWidth={2.3} />} onClick={() => setStep('password')}>
                I have the key
              </GateButton>
              <GateButton variant="ghost" icon={<Eye size={16} strokeWidth={2.2} />} onClick={closeEditPrompt}>
                I’m just reading
              </GateButton>
            </div>
          </>
        ) : (
          <>
            <Section
              eyebrow="YOUR KEY"
              title="Enter the code"
              titleId="gate-title"
            />
            <Dots length={CODE_LENGTH} filled={pw.length} error={!!err} />
            <div
              style={{
                fontSize: 12.5,
                marginTop: 12,
                minHeight: 16,
                color: err ? '#ff5a5a' : 'var(--color-sub)',
                opacity: err || busy ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              {err ?? (busy ? 'Checking…' : '')}
            </div>
            <Keypad
              onDigit={pressDigit}
              onBackspace={pressBackspace}
              canDelete={pw.length > 0 && !busy}
            />
            <button
              className="tap"
              onClick={() => setStep('ask')}
              style={{
                marginTop: 18,
                background: 'none',
                border: 'none',
                color: 'var(--color-sub)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 8,
              }}
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── The code dots: one per digit, filled volt as you type; shudder on a miss ─── */
function Dots({
  length,
  filled,
  error,
}: {
  length: number
  filled: number
  error: boolean
}) {
  return (
    <div
      className="gate-dots"
      data-error={error ? 'true' : 'false'}
      style={{
        display: 'flex',
        gap: 18,
        marginTop: 20,
        height: 14,
        alignItems: 'center',
      }}
    >
      {Array.from({ length }).map((_, i) => {
        const on = i < filled
        return (
          <span
            key={i}
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              border: '1.5px solid var(--color-volt)',
              background: on ? 'var(--color-volt)' : 'transparent',
              boxShadow: on ? '0 0 8px rgba(205, 244, 99, 0.5)' : 'none',
              transition: 'background 0.12s ease, box-shadow 0.12s ease',
            }}
          />
        )
      })}
    </div>
  )
}

/* ── The keypad: round volt keys, iPhone-style letters, a backspace by the 0 ──── */
const KEYS: { d: string; letters: string }[] = [
  { d: '1', letters: '' },
  { d: '2', letters: 'ABC' },
  { d: '3', letters: 'DEF' },
  { d: '4', letters: 'GHI' },
  { d: '5', letters: 'JKL' },
  { d: '6', letters: 'MNO' },
  { d: '7', letters: 'PQRS' },
  { d: '8', letters: 'TUV' },
  { d: '9', letters: 'WXYZ' },
]

function Keypad({
  onDigit,
  onBackspace,
  canDelete,
}: {
  onDigit: (d: string) => void
  onBackspace: () => void
  canDelete: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginTop: 6,
        width: '100%',
        placeItems: 'center',
      }}
    >
      {KEYS.map((k) => (
        <KeyButton key={k.d} digit={k.d} letters={k.letters} onPress={onDigit} />
      ))}
      <span aria-hidden />
      <KeyButton digit="0" letters="" onPress={onDigit} />
      <button
        type="button"
        className="keypad-backspace"
        onClick={onBackspace}
        disabled={!canDelete}
        aria-label="Delete"
      >
        <Delete size={24} strokeWidth={2} />
      </button>
    </div>
  )
}

function KeyButton({
  digit,
  letters,
  onPress,
}: {
  digit: string
  letters: string
  onPress: (d: string) => void
}) {
  return (
    <button
      type="button"
      className="keypad-key"
      onClick={() => onPress(digit)}
      aria-label={digit}
    >
      <span className="keypad-digit">{digit}</span>
      {letters ? <span className="keypad-letters">{letters}</span> : null}
    </button>
  )
}

/* ── The signature: a volt lock-dial that springs open on the right key ──────── */
function LockDial({ open }: { open: boolean }) {
  const Glyph = open ? LockOpen : Lock
  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        width: 104,
        height: 104,
        display: 'grid',
        placeItems: 'center',
        marginBottom: 22,
      }}
    >
      <svg
        width={104}
        height={104}
        viewBox="0 0 104 104"
        style={{ position: 'absolute', inset: 0 }}
      >
        <circle cx="52" cy="52" r="34" fill="rgba(205,244,99,0.05)" />
        <circle
          cx="52"
          cy="52"
          r="46"
          fill="none"
          stroke="var(--color-volt)"
          strokeWidth="3"
          style={{
            filter: open
              ? 'drop-shadow(0 0 14px rgba(205,244,99,0.65))'
              : 'drop-shadow(0 0 8px rgba(205,244,99,0.4))',
            transition: 'filter 0.4s ease',
          }}
        />
      </svg>
      <span
        key={open ? 'open' : 'closed'}
        className={open ? 'lock-pop' : undefined}
        style={{
          color: 'var(--color-volt)',
          display: 'flex',
          filter: open ? 'drop-shadow(0 0 10px rgba(205,244,99,0.6))' : 'none',
        }}
      >
        <Glyph size={30} strokeWidth={2.2} />
      </span>
    </div>
  )
}

/* Shared eyebrow + title + optional body — keeps the three steps in lockstep. */
function Section({
  eyebrow,
  title,
  titleId,
  body,
}: {
  eyebrow: string
  title: string
  titleId: string
  body?: string
}) {
  return (
    <>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.14em',
          color: 'var(--color-sub)',
        }}
      >
        {eyebrow}
      </div>
      <div
        id={titleId}
        style={{
          fontSize: 25,
          fontWeight: 760,
          letterSpacing: '-0.02em',
          marginTop: 7,
          color: 'var(--color-text)',
        }}
      >
        {title}
      </div>
      {body ? (
        <div
          style={{
            fontSize: 13.5,
            color: 'var(--color-sub)',
            lineHeight: 1.5,
            marginTop: 10,
            maxWidth: 268,
          }}
        >
          {body}
        </div>
      ) : null}
    </>
  )
}

const stackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 9,
  width: '100%',
  marginTop: 22,
}

function GateButton({
  variant,
  icon,
  children,
  onClick,
  disabled,
}: {
  variant: 'volt' | 'ghost'
  icon?: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  const volt = variant === 'volt'
  const dead = disabled
  return (
    <button
      className={dead ? undefined : 'tap press'}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: volt ? 50 : 46,
        borderRadius: 25,
        border: volt ? 'none' : '1px solid var(--color-pill-border)',
        background: volt
          ? dead
            ? 'var(--color-card-border)'
            : 'var(--color-volt)'
          : 'transparent',
        color: volt
          ? dead
            ? 'var(--color-dim)'
            : 'var(--color-on-volt)'
          : 'var(--color-sub)',
        fontSize: 15,
        fontWeight: volt ? 700 : 600,
        cursor: dead ? 'default' : 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
  )
}
