import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { Home } from '@/screens/Home'
import { Log } from '@/screens/Log'
import { History } from '@/screens/History'
import { Library } from '@/screens/Library'

export function App() {
  return (
    <BrowserRouter>
      <div className="app-frame">
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/library" element={<Library />} />
          </Route>
          <Route path="/log" element={<Log />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
