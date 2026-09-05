import { NavLink } from 'react-router-dom'
import { HistoryIcon, HomeIcon, LibraryIcon } from './icons'

const TABS = [
  { to: '/', Icon: HomeIcon, label: 'Today' },
  { to: '/history', Icon: HistoryIcon, label: 'History' },
  { to: '/library', Icon: LibraryIcon, label: 'Plan' },
]

/** Docked tab bar — a compact, flat band that occupies real layout space, so
 *  screen content can never hide behind it. Each destination is named for the
 *  question it answers: today's work or the broader plan. */
export function TabBar() {
  return (
    <div
      style={{
        flexShrink: 0,
        background: 'rgba(11,11,12,0.94)',
        borderTop: '1px solid var(--color-card-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: `4px 20px calc(6px + env(safe-area-inset-bottom))`,
      }}
    >
      <nav
        style={{
          height: 54,
          display: 'flex',
          alignItems: 'stretch',
          gap: 8,
        }}
      >
        {TABS.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className="tap"
            style={({ isActive }) => ({
              flex: 1,
              color: isActive ? 'var(--color-text)' : 'var(--color-idle)',
              background: 'transparent',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            })}
          >
            <Icon />
            <span
              style={{
                fontSize: 11,
                fontWeight: 640,
                letterSpacing: '0.02em',
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
