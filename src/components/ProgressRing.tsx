import type { ReactNode } from 'react'

interface Props {
  /** filled fraction, 0–100 */
  pct: number
  size?: number
  inner?: number
  color?: string
  children?: ReactNode
}

/** Conic progress ring with a card-colored inner disc (the hero/up-next ring). */
export function ProgressRing({
  pct,
  size = 68,
  inner = 56,
  color = 'var(--color-volt)',
  children,
}: Props) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `conic-gradient(${color} 0 ${clamped}%, var(--color-ring-off) ${clamped}% 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: 'var(--color-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
