import { Lock, KeyRound, Pencil, Check, RefreshCw, Cloud, Eye } from 'lucide-react'
import { useSyncState, exitEditMode, openEditPrompt } from '@/lib/sync'

/**
 * Mode bar for the Home screen. Shows whether you're in public view-only mode or
 * editing, plus cloud-sync status. Tapping switches: a viewer can unlock editing
 * (opens the password prompt); an editor can lock back to view-only. Renders
 * nothing when Supabase isn't configured (plain offline app).
 */
export function SyncBar() {
  const state = useSyncState()
  if (!state.configured) return null

  const editing = state.editMode
  const syncing = state.status === 'syncing'
  const error = state.status === 'error'

  const Icon = editing ? Pencil : Eye
  const label = editing ? 'Editing' : 'Read only'

  const StatusIcon = error ? Cloud : syncing ? RefreshCw : Check
  const statusText = error
    ? 'Sync error'
    : syncing
      ? 'Saving…'
      : editing
        ? 'Saved'
        : 'Live'

  return (
    <div
      style={{
        border: '1px solid var(--color-pill-border)',
        borderRadius: 16,
        background: 'var(--color-card)',
        padding: '10px 12px 10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        style={{
          color: editing ? 'var(--color-volt)' : 'var(--color-sub)',
          display: 'flex',
        }}
      >
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{label}</span>

      {/* subtle cloud-sync status */}
      <span
        title={statusText}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: error ? '#ff5a5a' : 'var(--color-dim)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <StatusIcon size={12} strokeWidth={2.2} />
        {statusText}
      </span>

      {editing ? (
        <button
          className="tap"
          onClick={exitEditMode}
          style={btnStyle}
        >
          <Lock size={13} strokeWidth={2.3} />
          Lock
        </button>
      ) : (
        <button
          className="tap"
          onClick={openEditPrompt}
          style={{ ...btnStyle, color: 'var(--color-volt)', borderColor: 'rgba(205,244,99,.3)' }}
        >
          <KeyRound size={13} strokeWidth={2.3} />
          Unlock
        </button>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  paddingInline: 12,
  borderRadius: 16,
  background: 'var(--color-bg)',
  border: '1px solid var(--color-pill-border)',
  color: 'var(--color-text)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
}
