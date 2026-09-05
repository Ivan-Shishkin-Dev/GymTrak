export function DiscardDialog({ title, body, onConfirm, onCancel }: { title: string; body: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.68)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(event) => event.stopPropagation()} className="card" role="alertdialog" aria-modal="true" style={{ width: '100%', maxWidth: 340, borderRadius: 18, padding: 22 }}>
        <div className="display" style={{ fontSize: 24, fontWeight: 700 }}>{title}</div>
        <div style={{ marginTop: 8, color: 'var(--color-sub)', fontSize: 13.5, lineHeight: 1.5 }}>{body}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          <button className="tap" onClick={onConfirm} style={{ height: 46, borderRadius: 12, border: 0, background: 'var(--color-red)', color: '#fff', fontSize: 14, fontWeight: 700 }}>Discard session</button>
          <button className="tap" onClick={onCancel} style={{ height: 44, borderRadius: 12, border: '1px solid var(--color-pill-border)', background: 'transparent', color: 'var(--color-sub)', fontSize: 14, fontWeight: 630 }}>Keep going</button>
        </div>
      </div>
    </div>
  )
}
