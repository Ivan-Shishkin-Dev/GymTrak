import { Outlet } from 'react-router-dom'
import { TabBar } from './TabBar'

/** Layout for the four tabbed screens: the screen fills the frame, tab bar floats over it. */
export function AppLayout() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  )
}
