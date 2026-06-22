import { NavLink } from 'react-router-dom'
import { HomeIcon, LibraryIcon } from './icons'

const TABS = [
  { to: '/', Icon: HomeIcon, label: 'Home' },
  { to: '/library', Icon: LibraryIcon, label: 'Library' },
]

/** Docked tab bar — a solid band holding the blurred pill nav. It occupies real
 *  layout space at the bottom (not a floating overlay), so screen content sits
 *  above it and can never hide behind it. Shown on every screen except /log. */
export function TabBar() {
  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--color-bg)',
        padding: `8px 24px calc(12px + env(safe-area-inset-bottom))`,
      }}
    >
      <nav
        style={{
          height: 62,
          borderRadius: 32,
          background: 'rgba(19,19,22,0.92)',
          border: '1px solid var(--color-pill-border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
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
              color: isActive ? 'var(--color-text)' : 'var(--color-idle)',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Icon />
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
