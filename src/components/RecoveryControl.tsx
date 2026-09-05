import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { restoreRecoverySnapshot } from '@/lib/sync'

export function RecoveryControl() {
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  return (
    <div className="card" style={{ borderRadius: 16, padding: 16 }}>
      <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>Recovery</div>
      <div style={{ marginTop: 4, color: 'var(--color-sub)', fontSize: 12.5, lineHeight: 1.45 }}>
        GymTrak keeps a local safety copy before cloud data replaces this device.
      </div>
      {confirming ? (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, color: 'var(--color-sub)', fontSize: 12 }}>Replace current local data?</span>
          <button className="tap" onClick={() => setConfirming(false)} style={buttonStyle}>Cancel</button>
          <button className="tap" onClick={async () => { const restored = await restoreRecoverySnapshot(); setStatus(restored ? 'Recovery restored' : 'No recovery copy found'); setConfirming(false) }} style={{ ...buttonStyle, color: 'var(--color-volt)' }}>Restore</button>
        </div>
      ) : (
        <button className="tap" onClick={() => setConfirming(true)} style={{ ...buttonStyle, display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
          <RotateCcw size={13} /> Restore local copy
        </button>
      )}
      {status && <div role="status" style={{ marginTop: 8, color: 'var(--color-volt)', fontSize: 11.5 }}>{status}</div>}
    </div>
  )
}

const buttonStyle: React.CSSProperties = { minHeight: 36, border: 0, background: 'transparent', color: 'var(--color-sub)', padding: '6px 4px', fontSize: 12, fontWeight: 650 }
