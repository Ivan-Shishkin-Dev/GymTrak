import { Lock, KeyRound, Check, RefreshCw, Cloud } from 'lucide-react'
import { useSyncState, exitEditMode, openEditPrompt } from '@/lib/sync'

/**
 * Compact sync/mode cluster for the Home title row. When editing (the normal
 * state on Ivan's phone) it's just a status glyph and a lock button — the mode
 * needs no announcement. Viewers get an explicit "Unlock" pill instead. Errors
 * are the one state that earns words. Renders nothing when Supabase isn't
 * configured (plain offline app).
 */
export function SyncBar() {
  const state = useSyncState()
  if (!state.configured) return null

  const syncing = state.status === 'syncing'
  const error = state.status === 'error'

  if (!state.editMode) {
    return (
      <button
        className="tap"
        onClick={openEditPrompt}
        style={{
          ...pillStyle,
          color: 'var(--color-volt)',
          borderColor: 'rgba(205,244,99,.3)',
        }}
      >
        <KeyRound size={13} strokeWidth={2.3} />
        Unlock
      </button>
    )
  }

  const StatusIcon = error ? Cloud : syncing ? RefreshCw : Check
  const statusText = error ? 'Sync error' : syncing ? 'Saving…' : 'Saved'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {error && (
        <span style={{ fontSize: 11, color: '#ff5a5a', fontFamily: 'var(--font-mono)' }}>
          Sync error
        </span>
      )}
      <span
        title={statusText}
        style={{ display: 'flex', color: error ? '#ff5a5a' : 'var(--color-dim)' }}
      >
        <StatusIcon size={14} strokeWidth={2.2} />
      </span>
      <button
        className="tap"
        onClick={exitEditMode}
        aria-label="Lock editing"
        title="Lock editing"
        style={{ ...pillStyle, paddingInline: 0, width: 32, justifyContent: 'center' }}
      >
        <Lock size={13} strokeWidth={2.3} />
      </button>
    </div>
  )
}

const pillStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  paddingInline: 12,
  borderRadius: 16,
  background: 'transparent',
  border: '1px solid var(--color-pill-border)',
  color: 'var(--color-text)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
}
