import { Check } from 'lucide-react'
import { DOWS, slotDate, slotSummary } from '@/lib/program'
import type { Dow, Day, ProgramWeek } from '@/db/types'

/**
 * The training week as seven plain-language rows.
 *
 * This replaced a seven-across strip of cells reading `U-A` / `L-A` / `RUN`.
 * Codes fit, but they have to be decoded — and the one question this screen
 * exists to answer is "what am I doing". A row is wide enough to just say it.
 *
 * Tapping a row selects it, which drives the card above; today is marked, and a
 * day with a finished session gets a check. Renders as a stack of hairline-
 * separated rows meant to sit inside a `.card.list-card`.
 */

export function WeekList({
  week,
  days,
  doneDates,
  todayKey,
  selected,
  onSelect,
}: {
  week: ProgramWeek
  days: Day[]
  /** 'yyyy-MM-dd' of every date with a finished session. */
  doneDates: Set<string>
  todayKey: string
  selected: Dow
  onSelect: (dow: Dow) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {DOWS.map((dow, i) => {
        const slot = week.slots.find((s) => s.dow === dow)
        const date = slotDate(week, dow)
        const isToday = date === todayKey
        const isSel = dow === selected
        const done = doneDates.has(date)
        const dayName = days.find((d) => d.id === slot?.liftDayId)?.name ?? null
        const text = slotSummary(slot, dayName)
        const rest = text === 'Rest'

        return (
          <button
            key={dow}
            className="tap"
            onClick={() => onSelect(dow)}
            aria-pressed={isSel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '12px 16px 12px 14px',
              // The selected row is the loud state — it's what the card is
              // showing. Today is quieter, marked by the dot on the right.
              background: isSel ? 'var(--color-volt-tint)' : 'transparent',
              border: 'none',
              borderTop: i > 0 ? '1px solid var(--color-separator)' : 'none',
              boxShadow: isSel ? 'inset 2px 0 0 var(--color-volt)' : 'none',
              color: 'var(--color-text)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: '0.1em',
                width: 34,
                flexShrink: 0,
                color: isSel
                  ? 'var(--color-volt)'
                  : isToday
                    ? 'var(--color-sub)'
                    : 'var(--color-dim)',
              }}
            >
              {dow.toUpperCase()}
            </span>

            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14.5,
                fontWeight: isSel ? 640 : 520,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: rest ? 'var(--color-future)' : 'var(--color-text)',
              }}
            >
              {text}
            </span>

            <span
              style={{
                width: 14,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-volt)',
              }}
            >
              {done ? (
                <Check size={13} strokeWidth={3} />
              ) : isToday ? (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--color-volt)',
                  }}
                />
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
