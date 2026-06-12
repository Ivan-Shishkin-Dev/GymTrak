import { NavLink } from 'react-router-dom'
import {
  HistoryIcon,
  HomeIcon,
  LibraryIcon,
  ProgressIcon,
} from './icons'

const TABS = [
  { to: '/', Icon: HomeIcon, label: 'Home' },
  { to: '/history', Icon: HistoryIcon, label: 'History' },
  { to: '/progress', Icon: ProgressIcon, label: 'Progress' },
  { to: '/library', Icon: LibraryIcon, label: 'Library' },
]

/** Floating, blurred pill nav — visible on every screen except /log. */
export function TabBar() {
  return (
    <nav
      style={{
        position: 'absolute',
        left: 24,
        right: 24,
        bottom: `calc(24px + env(safe-area-inset-bottom))`,
        height: 62,
        borderRadius: 32,
        background: 'rgba(19,19,22,0.92)',
        border: '1px solid var(--color-pill-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 30,
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
  )
}
