import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { IdentityGate } from '@/components/IdentityGate'
import { Home } from '@/screens/Home'
import { Log } from '@/screens/Log'
import { Library } from '@/screens/Library'

export function App() {
  return (
    <BrowserRouter>
      <div className="app-frame">
        <IdentityGate />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
          </Route>
          <Route path="/log" element={<Log />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
