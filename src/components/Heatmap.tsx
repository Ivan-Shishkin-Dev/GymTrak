import type { DotState, HeatmapColumn } from '@/lib/stats'

interface Props {
  columns: HeatmapColumn[]
  tint?: 'white' | 'volt'
  dotSize?: number
  labels?: 'top' | 'bottom' | 'none'
}

function dotColor(state: DotState, volt: boolean): string {
  if (state === 'off') return 'var(--color-dot-off)'
  if (volt) {
    return state === 'bright' ? '#CDF463' : 'rgba(205,244,99,0.55)'
  }
  return state === 'bright' ? 'rgba(255,255,255,0.95)' : 'var(--color-dot-on)'
}

/** Three month-columns of a 7-wide Mon→Sun dot grid (the consistency heatmap). */
export function Heatmap({
  columns,
  tint = 'white',
  dotSize = 5,
  labels = 'top',
}: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 6px' }}>
      {columns.map((col, ci) => (
        <div
          key={ci}
          style={{
            display: 'flex',
            flexDirection: labels === 'bottom' ? 'column-reverse' : 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {labels !== 'none' && (
            <div style={{ fontSize: 12, color: 'var(--color-sub)' }}>{col.name}</div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(7, ${dotSize}px)`,
              gap: 5,
              justifyItems: 'center',
              alignItems: 'center',
            }}
          >
            {col.dots.map((state, di) => (
              <div
                key={di}
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  background: dotColor(state, tint === 'volt' && col.current),
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
