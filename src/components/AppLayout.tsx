import { Outlet } from 'react-router-dom'
import { TabBar } from './TabBar'

/** Layout for the tabbed screens: content scrolls in a region docked ABOVE the
 *  tab bar, so the bar never covers content. */
export function AppLayout() {
  return (
    <div className="app-shell">
      <div className="screen-scroll">
        <Outlet />
      </div>
      <TabBar />
    </div>
  )
}
