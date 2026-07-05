import { dayMonogram } from '@/lib/rotation'
import type { Day } from '@/db/types'

/**
 * The whole split at a glance — one cell per day in rotation order, so the
 * Upper/Lower rhythm (UA · LA · UB · LB · UC · LC) reads top-to-bottom of the
 * screen. The shown day is lit volt; a small volt dot marks where the cycle will
 * actually resume when you're previewing some other day. Tapping a cell previews
 * it in the hero.
 */
export function CycleRail({
  days,
  selectedId,
  autoId,
  onSelect,
}: {
  days: Day[]
  selectedId?: number
  autoId?: number
  onSelect: (id: number) => void
}) {
  if (!days.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {days.map((d, i) => {
          const selected = d.id === selectedId
          const isAuto = d.id === autoId
          const accent = selected ? 'var(--color-volt)' : undefined
          return (
            <button
              key={d.id}
              className="tap press"
              onClick={() => onSelect(d.id)}
              aria-label={`Preview ${d.name}`}
              aria-pressed={selected}
              style={{
                position: 'relative',
                flex: '1 1 0',
                minWidth: 46,
                height: 44,
                borderRadius: 14,
                border: selected
                  ? '1px solid var(--color-volt)'
                  : '1px solid var(--color-pill-border)',
                background: selected ? 'var(--color-volt-tint)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, background 0.15s ease',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: accent ?? 'var(--color-sub)',
                }}
              >
                {dayMonogram(d.name, i + 1)}
              </span>
              {isAuto && !selected && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--color-volt)',
                  }}
                />
              )}
            </button>
          )
        })}
    </div>
  )
}
