import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { reopenSession } from '@/lib/actions'
import { sessionRoute } from '@/lib/session'

type CompletionState = { completedSessionId?: string; completedLabel?: string }

export function CompletionToast() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = (location.state ?? {}) as CompletionState
  const id = state.completedSessionId

  useEffect(() => {
    if (!id) return
    const timer = setTimeout(() => navigate(location.pathname, { replace: true, state: null }), 8000)
    return () => clearTimeout(timer)
  }, [id, location.pathname, navigate])

  if (!id) return null
  return (
    <div style={{ position: 'absolute', zIndex: 45, left: 20, right: 20, bottom: 'calc(70px + env(safe-area-inset-bottom))' }}>
      <div className="card" role="status" aria-live="polite" style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 32px rgba(0,0,0,.35)' }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 630 }}>
          {state.completedLabel ?? 'Session'} saved
        </span>
        <button
          className="tap"
          onClick={async () => {
            const session = await reopenSession(id)
            if (session) navigate(sessionRoute(session), { replace: true, state: null })
          }}
          style={{ border: 0, background: 'transparent', color: 'var(--color-volt)', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px', fontSize: 13, fontWeight: 700 }}
        >
          <RotateCcw size={14} /> Undo
        </button>
      </div>
    </div>
  )
}
