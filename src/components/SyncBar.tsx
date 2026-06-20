import { useState, useSyncExternalStore } from 'react'
import { Cloud, Check, RefreshCw, LogOut } from 'lucide-react'
import {
  subscribeSync,
  getSyncSnapshot,
  signInWithEmail,
  signOut,
  syncNow,
} from '@/lib/sync'

/**
 * Compact cloud-sync control for the Home screen. Signed out, it offers a
 * magic-link sign-in; signed in, it shows status and a sign-out. Renders nothing
 * when Supabase isn't configured, so the app stays a plain offline tracker.
 */
export function SyncBar() {
  const state = useSyncExternalStore(subscribeSync, getSyncSnapshot)
  const [open, setOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!state.configured) return null

  const signedIn = state.status === 'synced' || state.status === 'syncing'

  async function send() {
    const e = emailInput.trim()
    if (!e || sending) return
    setSending(true)
    setErr(null)
    const res = await signInWithEmail(e)
    setSending(false)
    if (res.error) setErr(res.error)
    else setSent(true)
  }

  const label =
    state.status === 'syncing'
      ? 'Syncing…'
      : state.status === 'synced'
        ? 'Synced'
        : state.status === 'error'
          ? 'Sync error'
          : 'Sync across devices'

  const Icon =
    state.status === 'synced'
      ? Check
      : state.status === 'syncing'
        ? RefreshCw
        : Cloud

  return (
    <div
      style={{
        border: '1px solid var(--color-pill-border)',
        borderRadius: 16,
        background: 'var(--color-card)',
        padding: open ? 14 : '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: open ? 12 : 0,
        transition: 'padding 0.15s ease',
      }}
    >
      {/* status / toggle row */}
      <button
        className="tap"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--color-text)',
          width: '100%',
        }}
      >
        <span
          style={{
            color:
              state.status === 'synced'
                ? 'var(--color-volt)'
                : state.status === 'error'
                  ? '#ff5a5a'
                  : 'var(--color-sub)',
            display: 'flex',
          }}
        >
          <Icon size={17} strokeWidth={2.2} />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, textAlign: 'left' }}>
          {label}
        </span>
        {signedIn && state.email && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-dim)',
              fontFamily: 'var(--font-mono)',
              maxWidth: 160,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {state.email}
          </span>
        )}
      </button>

      {/* expanded panel */}
      {open && !signedIn && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sent ? (
            <div style={{ fontSize: 13, color: 'var(--color-sub)', lineHeight: 1.45 }}>
              Check <strong style={{ color: 'var(--color-text)' }}>{emailInput.trim()}</strong>{' '}
              and tap the link to finish signing in — on any device you want synced.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--color-sub)', lineHeight: 1.45 }}>
                Enter your email. We'll send a one-tap sign-in link — no password.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="you@email.com"
                  style={{
                    flex: 1,
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-pill-border)',
                    borderRadius: 12,
                    color: 'var(--color-text)',
                    padding: '10px 12px',
                    fontSize: 14,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  className="tap"
                  onClick={send}
                  disabled={!emailInput.trim() || sending}
                  style={{
                    paddingInline: 16,
                    borderRadius: 12,
                    background: emailInput.trim()
                      ? 'var(--color-volt)'
                      : 'var(--color-card-border)',
                    color: emailInput.trim() ? 'var(--color-on-volt)' : 'var(--color-dim)',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: emailInput.trim() ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                >
                  {sending ? '…' : 'Send'}
                </button>
              </div>
            </>
          )}
          {err && <div style={{ fontSize: 12, color: '#ff5a5a' }}>{err}</div>}
        </div>
      )}

      {open && signedIn && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="tap"
            onClick={() => void syncNow()}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 12,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-pill-border)',
              color: 'var(--color-text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <RefreshCw size={14} strokeWidth={2.2} /> Sync now
          </button>
          <button
            className="tap"
            onClick={() => {
              void signOut()
              setOpen(false)
              setSent(false)
            }}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 12,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-pill-border)',
              color: 'var(--color-sub)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <LogOut size={14} strokeWidth={2.2} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
