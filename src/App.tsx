import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { IdentityGate } from '@/components/IdentityGate'
import { ScreenWakeLock } from '@/components/ScreenWakeLock'
import { NoticeHost } from '@/components/NoticeHost'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'

const Home = lazy(() => import('@/screens/Home').then((module) => ({ default: module.Home })))
const History = lazy(() => import('@/screens/History').then((module) => ({ default: module.History })))
const Library = lazy(() => import('@/screens/Library').then((module) => ({ default: module.Library })))
const Log = lazy(() => import('@/screens/Log').then((module) => ({ default: module.Log })))
const Run = lazy(() => import('@/screens/Run').then((module) => ({ default: module.Run })))

export function App() {
  return (
    <BrowserRouter>
      <div className="app-frame">
        <ScreenWakeLock />
        <IdentityGate />
        <NoticeHost />
        <AppErrorBoundary>
          <Suspense fallback={<div className="screen"><div className="skeleton" style={{ height: 120 }} /></div>}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/history" element={<History />} />
                <Route path="/library" element={<Library />} />
              </Route>
              <Route path="/log" element={<Log />} />
              <Route path="/run" element={<Run />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppErrorBoundary>
      </div>
    </BrowserRouter>
  )
}
