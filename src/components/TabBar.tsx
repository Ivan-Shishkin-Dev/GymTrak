import { NavLink } from 'react-router-dom'
import { HomeIcon, LibraryIcon } from './icons'

const TABS = [
  { to: '/', Icon: HomeIcon, label: 'Home' },
  { to: '/library', Icon: LibraryIcon, label: 'Library' },
]

/** Docked tab bar — a solid band holding the blurred pill nav. It occupies real
 *  layout space at the bottom (not a floating overlay), so screen content sits
 *  above it and can never hide behind it. Shown on every screen except /log.
 *  Each tab is an icon over its name; the active one is volt, the same "you are
 *  here" the week list uses. */
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
        className="card"
        style={{
          height: 64,
          borderRadius: 32,
          background: 'rgba(19,19,22,0.92)',
          borderColor: 'var(--color-pill-border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'stretch',
          padding: 4,
          gap: 4,
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
              color: isActive ? 'var(--color-volt)' : 'var(--color-idle)',
              background: isActive ? 'var(--color-volt-tint)' : 'transparent',
              borderRadius: 28,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              textDecoration: 'none',
              transition: 'color 0.15s ease, background 0.15s ease',
            })}
          >
            <Icon />
            <span
              style={{
                fontSize: 10.5,
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
