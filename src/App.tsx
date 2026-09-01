import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { IdentityGate } from '@/components/IdentityGate'
import { ScreenWakeLock } from '@/components/ScreenWakeLock'
import { Home } from '@/screens/Home'
import { Log } from '@/screens/Log'
import { Run } from '@/screens/Run'
import { Library } from '@/screens/Library'

export function App() {
  return (
    <BrowserRouter>
      <div className="app-frame">
        <ScreenWakeLock />
        <IdentityGate />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
          </Route>
          <Route path="/log" element={<Log />} />
          <Route path="/run" element={<Run />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
