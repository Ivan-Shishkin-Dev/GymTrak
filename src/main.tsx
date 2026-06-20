import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { initSync } from './lib/sync'
import './index.css'

// keep the cached app shell fresh in the background
registerSW({ immediate: true })

// Seed (when signed-out/offline) or adopt the cloud (when signed-in), then keep
// the local DB in sync. Live queries pick up whatever lands.
void initSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
