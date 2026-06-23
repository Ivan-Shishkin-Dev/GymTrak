import { Outlet } from 'react-router-dom'
import { TabBar } from './TabBar'
import { ResumeBanner } from './ResumeBanner'

/** Layout for the tabbed screens: content scrolls in a region docked ABOVE the
 *  tab bar, so the bar never covers content. A resume banner docks just above the
 *  tab bar whenever a workout is in progress. */
export function AppLayout() {
  return (
    <div className="app-shell">
      <div className="screen-scroll">
        <Outlet />
      </div>
      <ResumeBanner />
      <TabBar />
    </div>
  )
}
