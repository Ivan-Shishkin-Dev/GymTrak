import { useEffect, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'

export function NoticeHost() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const rejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      setMessage(reason instanceof Error ? reason.message : 'That change could not be saved.')
    }
    const error = (event: ErrorEvent) => setMessage(event.message || 'Something went wrong.')
    window.addEventListener('unhandledrejection', rejection)
    window.addEventListener('error', error)
    return () => {
      window.removeEventListener('unhandledrejection', rejection)
      window.removeEventListener('error', error)
    }
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 7000)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null
  return (
    <div role="alert" aria-live="assertive" style={{ position: 'fixed', zIndex: 200, top: 'calc(16px + env(safe-area-inset-top))', left: '50%', width: 'calc(100% - 40px)', maxWidth: 420, transform: 'translateX(-50%)' }}>
      <div className="card" style={{ borderRadius: 14, borderColor: 'rgba(255,90,90,.35)', padding: '12px 12px 12px 14px', display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 14px 36px rgba(0,0,0,.4)' }}>
        <AlertCircle size={17} color="var(--color-red)" />
        <span style={{ flex: 1, fontSize: 13, lineHeight: 1.35 }}>{message}</span>
        <button className="tap" onClick={() => setMessage(null)} aria-label="Dismiss" style={{ width: 30, height: 30, border: 0, background: 'transparent', color: 'var(--color-sub)', display: 'grid', placeItems: 'center' }}><X size={16} /></button>
      </div>
    </div>
  )
}
