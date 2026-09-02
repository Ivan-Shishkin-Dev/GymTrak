import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { initSync } from './lib/sync'
// Display face (latin only, 2 × 24 KB) — see --font-display in index.css.
import '@fontsource/barlow-semi-condensed/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
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
