import { daySplitLabel } from '@/lib/rotation'
import type { Day } from '@/db/types'

/**
 * The whole split at a glance — one cell per day in rotation order, each read in
 * real words: the split word in tiny caps over the variant (UPPER/A · LOWER/A …).
 * The shown day is lit volt; a small volt dot marks where the cycle will actually
 * resume when you're previewing some other day. Tapping a cell previews it in
 * the hero.
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
          const label = daySplitLabel(d.name, i + 1)
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
                height: 54,
                borderRadius: 14,
                border: selected
                  ? '1px solid var(--color-volt)'
                  : '1px solid var(--color-pill-border)',
                background: selected ? 'var(--color-volt-tint)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                paddingInline: 4,
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, background 0.15s ease',
              }}
            >
              {label.top && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: accent ?? 'var(--color-dim)',
                  }}
                >
                  {label.top}
                </span>
              )}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: label.top ? 15 : 13.5,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: accent ?? 'var(--color-sub)',
                }}
              >
                {label.main}
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
