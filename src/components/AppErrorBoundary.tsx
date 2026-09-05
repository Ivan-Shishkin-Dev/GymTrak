import { Component, type ErrorInfo, type ReactNode } from 'react'

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'The app hit an unexpected error.' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="card" role="alert" style={{ width: '100%', borderRadius: 18, padding: 22 }}>
          <div className="display" style={{ fontSize: 25, fontWeight: 700 }}>GymTrak needs a refresh</div>
          <div style={{ marginTop: 8, color: 'var(--color-sub)', fontSize: 13.5, lineHeight: 1.5 }}>{this.state.error}</div>
          <button onClick={() => window.location.reload()} style={{ width: '100%', height: 46, marginTop: 18, border: 0, borderRadius: 12, background: 'var(--color-volt)', color: 'var(--color-on-volt)', fontSize: 14, fontWeight: 700 }}>Reload app</button>
        </div>
      </div>
    )
  }
}
