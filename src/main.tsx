import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { seedIfEmpty } from './db/seed'
import './index.css'

// keep the cached app shell fresh in the background
registerSW({ immediate: true })

// seed the split (+ demo history) once; live queries pick it up when it lands
void seedIfEmpty()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
